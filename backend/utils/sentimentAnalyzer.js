const Sentiment = require('sentiment');
const sentimentAnalyzer = new Sentiment();

exports.analyzeFeedback = (feedbackArray) => {
    let totalScore = 0;
    let analyzedFeedback = [];
    let allTags = [];

    // Map categories to professional tags we want to add to the Nurse's profile
    const tagMap = {
        'Punctuality': 'Punctual',
        'Professionalism': 'Professional',
        'Compassion': 'Compassionate',
        'Communication': 'Great Communicator',
        'Clinical Skills': 'Highly Skilled'
    };

    // Analyze each sentence/category individually
    feedbackArray.forEach(item => {
        // Run the standard sentiment model on the specific category text
        const result = sentimentAnalyzer.analyze(item.text);
        
        // result.comparative normalizes the score based on string length (usually -1.0 to +1.0)
        analyzedFeedback.push({
            category: item.category,
            text: item.text,
            sentimentScore: result.comparative 
        });

        totalScore += result.comparative;

        // If the sentence for this category is positive, award the badge/tag!
        if (result.comparative > 0 && tagMap[item.category]) {
            allTags.push(tagMap[item.category]);
        }
    });

    const avgComparative = totalScore / feedbackArray.length;
    
    // Map the comparative score (-1.0 to 1.0) to a 1 to 5 star rating scale
    let calculatedRating = 3;
    if (avgComparative >= 0.4) calculatedRating = 5;
    else if (avgComparative >= 0.1) calculatedRating = 4;
    else if (avgComparative >= -0.1) calculatedRating = 3;
    else if (avgComparative >= -0.4) calculatedRating = 2;
    else calculatedRating = 1;

    // Flag extremely negative overall reviews for admin checking
    const status = (calculatedRating <= 1) ? 'Flagged' : 'Published';

    return {
        overallScore: avgComparative,
        rating: calculatedRating,
        feedbackDetails: analyzedFeedback,
        tags: [...new Set(allTags)], // Remove duplicates
        status
    };
};
