const Nurse = require('../models/Nurse');

// @desc    Get recommended nurses for a care request
// @route   POST /api/recommendations
// @access  Private (Patient only)
exports.getRecommendations = async (req, res) => {
    try {
        const { requiredTasks, location, schedule, primaryCondition, preferredGender, maxBudget } = req.body;
        
        if (!location || !location.coordinates || !schedule) {
            return res.status(400).json({ message: 'Missing location or schedule details' });
        }

        // --- STAGE 1: CANDIDATE GENERATION (MongoDB filtering) ---
        
        // 1. Geography query: Find nurses within 30km of patient location
        // Coordinates format: [longitude, latitude]
        const geoQuery = {
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: location.coordinates
                    },
                    $maxDistance: 30000 // 30 kilometers in meters
                }
            }
        };

        // 2. Hard constraints: Must be Active, must overlap on at least one day and time slot
        const query = {
            ...geoQuery,
            status: 'Active',
            'availability.days': { $in: schedule.days },
            'availability.timeSlots': { $in: schedule.timeSlots }
        };

        // Fetch candidates from MongoDB
        const candidates = await Nurse.find(query);

        if (candidates.length === 0) {
            return res.json({ message: 'No matching nurses found in your area.', recommendations: [] });
        }

        // Prepare request payload for Python ML service
        const patientRequestPayload = {
            requiredTasks: requiredTasks || [],
            location: { coordinates: location.coordinates },
            schedule: { days: schedule.days, timeSlots: schedule.timeSlots },
            primaryCondition: primaryCondition || "",
            preferredGender: preferredGender || "None",
            maxBudget: maxBudget || 0.0
        };

        const candidatesPayload = candidates.map(nurse => ({
            id: nurse._id.toString(),
            fullName: nurse.fullName,
            skills: nurse.skills || [],
            location: { coordinates: nurse.location.coordinates },
            availability: { 
                days: nurse.availability.days, 
                timeSlots: nurse.availability.timeSlots 
            },
            ratings: { 
                averageRating: nurse.ratings.averageRating, 
                totalReviews: nurse.ratings.totalReviews 
            },
            experienceYears: nurse.experienceYears || 0,
            specializations: nurse.specializations || [],
            gender: nurse.gender || "Other",
            pricing: { 
                hourlyRate: nurse.pricing?.hourlyRate || 0, 
                dailyRate: nurse.pricing?.dailyRate || 0, 
                emergencyRate: nurse.pricing?.emergencyRate || 0 
            },
            completionRate: 1.0, // Default prior
            historicalInteraction: 0.5 // Default prior
        }));

        // --- STAGE 2: CANDIDATE RANKING (Calling Python ML Microservice) ---
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000/recommend';
        
        try {
            const response = await fetch(mlServiceUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patient_request: patientRequestPayload,
                    candidates: candidatesPayload
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`ML Service responded with status ${response.status}: ${errorData}`);
            }

            const data = await response.json();
            
            // Send ranked recommendations back to user
            res.json(data);

        } catch (mlError) {
            console.error('ML service request failed, falling back to database sorting:', mlError);
            
            // Fallback: If ML service is down, sort candidates basic-style by distance
            res.json({
                message: "Fallback results (ML ranking engine unavailable)",
                recommendations: candidates.map(nurse => ({
                    nurse,
                    score: 0.5, // flat score
                    features: {}
                }))
            });
        }

    } catch (error) {
        res.status(500).json({ message: 'Server error during recommendation lookup', error: error.message });
    }
};
