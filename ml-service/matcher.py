import math
import numpy as np
import pandas as pd
from typing import List, Dict, Any

class NurseMatcher:
    def __init__(self):
        # In a real system, you would load a trained XGBoost model here:
        # self.model = xgb.Booster()
        # self.model.load_model("xgb_model.json")
        pass

    def haversine_distance(self, lon1: float, lat1: float, lon2: float, lat2: float) -> float:
        """Calculate the great circle distance between two points on the earth in km."""
        # Convert decimal degrees to radians
        lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])
        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        r = 6371 # Radius of earth in kilometers
        return c * r

    def calculate_jaccard_similarity(self, set1: set, set2: set) -> float:
        """Calculate Jaccard similarity coefficient between two sets."""
        if not set1 or not set2:
            return 0.0
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        return float(intersection) / float(union)

    def extract_features(self, patient_req: Dict[str, Any], nurse: Dict[str, Any]) -> Dict[str, float]:
        """Extracts the features required for the XGBoost ranking model as defined in Table 3.4."""
        
        # 1. Skill Overlap Score (Jaccard similarity between nurse skills and patient required tasks)
        patient_skills = set(patient_req.get("requiredTasks", []))
        nurse_skills = set(nurse.get("skills", []))
        skill_overlap = self.calculate_jaccard_similarity(patient_skills, nurse_skills)

        # 2. Distance Penalty (Haversine distance)
        p_coords = patient_req.get("location", {}).get("coordinates", [0.0, 0.0]) # [lng, lat]
        n_coords = nurse.get("location", {}).get("coordinates", [0.0, 0.0])
        distance = self.haversine_distance(p_coords[0], p_coords[1], n_coords[0], n_coords[1])
        # Simple distance normalization: clamp to 20km maximum and map to penalty
        distance_penalty = min(distance, 20.0) / 20.0 

        # 3. Availability Match (Exact or partial match)
        patient_days = set(patient_req.get("schedule", {}).get("days", []))
        nurse_days = set(nurse.get("availability", {}).get("days", []))
        patient_slots = set(patient_req.get("schedule", {}).get("timeSlots", []))
        nurse_slots = set(nurse.get("availability", {}).get("timeSlots", []))
        
        day_match = self.calculate_jaccard_similarity(patient_days, nurse_days) if patient_days else 1.0
        slot_match = self.calculate_jaccard_similarity(patient_slots, nurse_slots) if patient_slots else 1.0
        availability_match = (day_match + slot_match) / 2.0

        # 4. Average Rating
        avg_rating = nurse.get("ratings", {}).get("averageRating", 0.0)

        # 5. Completion Rate
        completion_rate = nurse.get("completionRate", 1.0) # default to 1.0 for new or good standing

        # 6. Experience in Years (Log-transformed as per thesis)
        exp_years = float(nurse.get("experienceYears", 0.0))
        log_experience = math.log1p(exp_years)

        # 7. Specialization Match (Binary: True if nurse has specialization matching patient condition)
        patient_condition = patient_req.get("primaryCondition", "").lower().strip()
        nurse_specs = [spec.lower().strip() for spec in nurse.get("specializations", [])]
        spec_match = 1.0 if any(spec in patient_condition or patient_condition in spec for spec in nurse_specs) else 0.0

        # 8. Gender Preference Match (Binary)
        pref_gender = patient_req.get("preferredGender", "None")
        nurse_gender = nurse.get("gender", "")
        if pref_gender == "None" or not pref_gender:
            gender_match = 1.0
        else:
            gender_match = 1.0 if pref_gender.lower() == nurse_gender.lower() else 0.0

        # 9. Price in Budget (Binary: True if nurse rate fits patient budget)
        max_budget = patient_req.get("maxBudget", 0.0)
        # Using dailyRate as pricing comparison standard
        nurse_rate = nurse.get("pricing", {}).get("dailyRate", 0.0)
        price_in_budget = 1.0 if max_budget <= 0.0 or nurse_rate <= max_budget else 0.0

        # 10. Historical Interaction (Collaborative signal)
        historical_interaction = nurse.get("historicalInteraction", 0.5) # 0.5 is neutral prior for cold-start

        return {
            "skill_overlap": skill_overlap,
            "distance_penalty": distance_penalty,
            "availability_match": availability_match,
            "average_rating": avg_rating,
            "completion_rate": completion_rate,
            "log_experience": log_experience,
            "spec_match": spec_match,
            "gender_match": gender_match,
            "price_in_budget": price_in_budget,
            "historical_interaction": historical_interaction
        }

    def rank_nurses(self, patient_req: Dict[str, Any], nurses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Ranks a list of candidate nurses against a patient request using simulated model weights."""
        if not nurses:
            return []

        ranked_candidates = []
        for nurse in nurses:
            features = self.extract_features(patient_req, nurse)
            
            # Simulated XGBoost Ranking Prediction (using feature weights representing the model output)
            # In production, this would be: score = self.model.predict(features_vector)
            score = (
                features["skill_overlap"] * 0.25 +
                (1.0 - features["distance_penalty"]) * 0.20 +
                features["availability_match"] * 0.15 +
                (features["average_rating"] / 5.0) * 0.10 +
                features["completion_rate"] * 0.05 +
                (features["log_experience"] / 3.0) * 0.05 +
                features["spec_match"] * 0.10 +
                features["gender_match"] * 0.05 +
                features["price_in_budget"] * 0.05 +
                features["historical_interaction"] * 0.05
            )

            ranked_candidates.append({
                "nurse": nurse,
                "score": float(score),
                "features": features
            })

        # Sort by score in descending order
        ranked_candidates.sort(key=lambda x: x["score"], reverse=True)
        return ranked_candidates
