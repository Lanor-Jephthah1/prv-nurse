const { GoogleGenerativeAI } = require('@google/generative-ai');
const vader = require('vader-sentiment');

const tagMap = {
    'Punctuality': 'Punctual',
    'Professionalism': 'Professional',
    'Compassion': 'Compassionate',
    'Communication': 'Great Communicator',
    'Clinical Skills': 'Highly Skilled'
};

// ==========================================
// 1. PRIMARY ENGINE: Google Gemini AI
// ==========================================
async function analyzeWithGemini(feedbackArray, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
        }
    });

    const prompt = `
You are an expert clinical sentiment analyzer for PRV Nurse, a home healthcare platform.
Evaluate this patient feedback given across specific visit categories:
${JSON.stringify(feedbackArray, null, 2)}

Instructions:
1. Provide a fair holistic "rating" from 1 to 5:
   - 5 = Outstanding / Exemplary care
   - 4 = Good / Satisfied visit
   - 3 = Average / Mixed experience
   - 2 = Dissatisfied / Notable deficiencies (e.g. nurse was late and unprofessional)
   - 1 = Terrible / Serious medical neglect
2. Calculate "overallScore" as a float between -1.0 (most negative) and 1.0 (most positive).
3. "tags": Array of positive badges earned ONLY if the category is genuinely positive:
   - Punctuality -> "Punctual"
   - Professionalism -> "Professional"
   - Compassion -> "Compassionate"
   - Communication -> "Great Communicator"
   - Clinical Skills -> "Highly Skilled"
4. "feedbackDetails": Array containing each category from the input with:
   - "category": string
   - "text": string
   - "sentimentScore": float between -1.0 and 1.0
   - "sentiment": "Positive" | "Negative" | "Neutral"
5. "status": "Flagged" if rating <= 2 or medical neglect/safety is mentioned, else "Published".

Respond ONLY with valid JSON in this exact structure:
{
  "rating": 5,
  "overallScore": 0.85,
  "tags": ["Punctual", "Professional", "Compassionate"],
  "feedbackDetails": [
    {
      "category": "Punctuality",
      "text": "...",
      "sentimentScore": 0.8,
      "sentiment": "Positive"
    }
  ],
  "status": "Published"
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
        engine: 'Gemini-3.6-Flash',
        overallScore: parsed.overallScore ?? 0,
        rating: parsed.rating ?? 3,
        feedbackDetails: parsed.feedbackDetails ?? [],
        tags: parsed.tags ?? [],
        status: parsed.status ?? 'Published'
    };
}

// ==========================================
// 2. EMERGENCY FALLBACK: VADER (Network Outages Only)
// ==========================================
function fallbackWithVader(feedbackArray) {
    let totalScore = 0;
    let analyzedFeedback = [];
    let allTags = [];

    // Healthcare domain adjustments for the fallback
    const CLINICAL_LEXICON = {
        'late': -2.5,
        'delayed': -2.0,
        'delay': -2.0,
        'unprofessional': -3.0,
        'rude': -3.0,
        'negligent': -3.5,
        'coma': -4.0,
        'professional': 2.5,
        'prompt': 2.5,
        'promptly': 2.5,
        'gentle': 2.0,
        'knowledgeable': 2.0,
        'organized': 2.0,
        'kindness': 2.5,
        'compassionate': 2.5
    };

    feedbackArray.forEach(item => {
        let score = vader.SentimentIntensityAnalyzer.polarity_scores(item.text);
        
        const words = item.text.toLowerCase().split(/\W+/);
        let clinicalAdjustment = 0;
        words.forEach((w, idx) => {
            if (CLINICAL_LEXICON[w] !== undefined) {
                const prevWord = idx > 0 ? words[idx - 1] : '';
                if (['not', 'never', 'hardly', 'barely', 'no'].includes(prevWord)) {
                    clinicalAdjustment += -CLINICAL_LEXICON[w] * 0.75;
                } else {
                    clinicalAdjustment += CLINICAL_LEXICON[w] * 0.3;
                }
            }
        });

        let finalCompound = Math.max(-1.0, Math.min(1.0, score.compound + clinicalAdjustment));
        
        analyzedFeedback.push({
            category: item.category,
            text: item.text,
            sentimentScore: parseFloat(finalCompound.toFixed(3)),
            sentiment: finalCompound >= 0.05 ? 'Positive' : (finalCompound <= -0.05 ? 'Negative' : 'Neutral')
        });

        totalScore += finalCompound;

        if (finalCompound > 0.1 && tagMap[item.category]) {
            allTags.push(tagMap[item.category]);
        }
    });

    const avgScore = totalScore / feedbackArray.length;

    let calculatedRating = 3;
    if (avgScore >= 0.35) calculatedRating = 5;
    else if (avgScore >= 0.08) calculatedRating = 4;
    else if (avgScore >= -0.08) calculatedRating = 3;
    else if (avgScore >= -0.35) calculatedRating = 2;
    else calculatedRating = 1;

    const status = (calculatedRating <= 1) ? 'Flagged' : 'Published';

    return {
        engine: 'VADER-Fallback (Network Outage)',
        overallScore: parseFloat(avgScore.toFixed(3)),
        rating: calculatedRating,
        feedbackDetails: analyzedFeedback,
        tags: [...new Set(allTags)],
        status
    };
}

// ==========================================
// 3. MAIN EXPORT: Gemini Primary with Network Fallback
// ==========================================
exports.analyzeFeedback = async (feedbackArray) => {
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Try Gemini AI as the primary engine
    if (apiKey) {
        try {
            return await analyzeWithGemini(feedbackArray, apiKey);
        } catch (networkError) {
            console.warn('⚠️ Network or service disruption contacting Gemini API. Utilizing emergency VADER fallback:', networkError.message);
        }
    }

    // 2. Only if network is down or API key is absent, use VADER fallback
    return fallbackWithVader(feedbackArray);
};
