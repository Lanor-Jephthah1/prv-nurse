const Review = require('../models/Review');
const Nurse = require('../models/Nurse');
const { analyzeFeedback } = require('../utils/sentimentAnalyzer');

/**
 * Background Event-Driven Worker for Review Sentiment Analysis & Nurse Ranking
 * Decouples the heavy AI analysis from the user HTTP response.
 */
async function processReviewAsync({ reviewId, nurseId, bookingId, feedback, explicitRating, io }) {
    try {
        console.log(`[ReviewPipeline] Starting background AI processing for Review ID: ${reviewId}`);

        // 1. Run Gemini AI sentiment analysis in the background
        const analysis = await analyzeFeedback(feedback);

        // 2. Decide final star rating
        const finalRating = explicitRating ? explicitRating : analysis.rating;

        // 3. Update the Review record
        const updatedReview = await Review.findByIdAndUpdate(
            reviewId,
            {
                $set: {
                    feedback: analysis.feedbackDetails,
                    rating: finalRating,
                    overallSentimentScore: analysis.overallScore,
                    tags: analysis.tags,
                    status: analysis.status // 'Published' or 'Flagged'
                }
            },
            { new: true }
        );

        // 4. Update the Nurse record with Bayesian Average
        const nurse = await Nurse.findById(nurseId);
        if (nurse) {
            const currentTotal = nurse.ratings?.totalReviews || 0;
            const currentAverage = nurse.ratings?.averageRating || 0;

            const newTotal = currentTotal + 1;
            const newAverage = ((currentAverage * currentTotal) + finalRating) / newTotal;

            // Bayesian Weighted Rating (Fair Ranking Algorithm)
            // m = 3 (minimum reviews to establish confidence), C = 4.0 (platform baseline prior)
            const m = 3;
            const C = 4.0;
            const weighted = ((newTotal / (newTotal + m)) * newAverage) + ((m / (newTotal + m)) * C);

            nurse.ratings.totalReviews = newTotal;
            nurse.ratings.averageRating = Number(newAverage.toFixed(1));
            nurse.ratings.weightedRating = Number(weighted.toFixed(2));

            // Update Category Averages (Map -1.0 -> 1.0 to a 1-5 scale)
            if (!nurse.ratings.categoryAverages) {
                nurse.ratings.categoryAverages = {
                    punctuality: 0, professionalism: 0, compassion: 0, communication: 0, clinicalSkills: 0
                };
            }
            
            const categoryMap = {
                'Punctuality': 'punctuality',
                'Professionalism': 'professionalism',
                'Compassion': 'compassion',
                'Communication': 'communication',
                'Clinical Skills': 'clinicalSkills'
            };

            if (analysis.feedbackDetails && Array.isArray(analysis.feedbackDetails)) {
                analysis.feedbackDetails.forEach(item => {
                    const dbKey = categoryMap[item.category];
                    if (dbKey && typeof item.sentimentScore === 'number') {
                        // Map -1 to 1 into 1 to 5
                        const mappedScore = (item.sentimentScore + 1) * 2 + 1;
                        const currentCatAvg = nurse.ratings.categoryAverages[dbKey] || 0;
                        // use currentTotal because it represents the N before this new review
                        const newCatAvg = ((currentCatAvg * currentTotal) + mappedScore) / newTotal;
                        nurse.ratings.categoryAverages[dbKey] = Number(newCatAvg.toFixed(2));
                    }
                });
            }

            // Merge earned badges into nurse skills
            if (analysis.tags && analysis.tags.length > 0) {
                const uniqueSkills = new Set([...(nurse.skills || []), ...analysis.tags]);
                nurse.skills = Array.from(uniqueSkills);
            }

            await nurse.save();
            console.log(`[ReviewPipeline] Successfully updated Nurse ${nurseId} - Avg: ${nurse.ratings.averageRating}, Weighted: ${nurse.ratings.weightedRating}`);
        }

        // 5. Emit real-time WebSocket event via Socket.IO if available
        if (io) {
            // Notify anyone in the booking room (patient or nurse)
            io.to(bookingId.toString()).emit('review_completed', {
                reviewId,
                status: analysis.status,
                rating: finalRating,
                tags: analysis.tags
            });

            // Broadcast general nurse rating update to active clients
            io.emit('nurse_rating_updated', {
                nurseId,
                averageRating: nurse?.ratings?.averageRating,
                weightedRating: nurse?.ratings?.weightedRating,
                totalReviews: nurse?.ratings?.totalReviews
            });
        }

        console.log(`[ReviewPipeline] Completed background processing for Review ${reviewId}. Status: ${analysis.status}`);
        return updatedReview;
    } catch (err) {
        console.error(`[ReviewPipeline] Error during background processing for Review ${reviewId}:`, err);
        // Ensure the review isn't permanently stuck in 'Processing' on critical failure
        await Review.findByIdAndUpdate(reviewId, {
            $set: { status: 'Flagged' }
        });
    }
}

module.exports = { processReviewAsync };
