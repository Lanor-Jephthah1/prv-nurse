from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from matcher import NurseMatcher

app = FastAPI(title="PRV Nurse ML Recommendation Engine")
matcher = NurseMatcher()

# Pydantic Schemas to validate request inputs
class Location(BaseModel):
    coordinates: List[float] # [longitude, latitude]

class Schedule(BaseModel):
    days: List[str]
    timeSlots: List[str]

class PatientRequest(BaseModel):
    requiredTasks: List[str]
    location: Location
    schedule: Schedule
    primaryCondition: str
    preferredGender: Optional[str] = "None"
    maxBudget: Optional[float] = 0.0

class NurseProfile(BaseModel):
    id: str
    fullName: str
    skills: List[str]
    location: Location
    availability: Schedule
    ratings: Dict[str, Any]
    experienceYears: float
    specializations: List[str]
    gender: str
    pricing: Dict[str, float]
    completionRate: Optional[float] = 1.0
    historicalInteraction: Optional[float] = 0.5

class RecommendationRequest(BaseModel):
    patient_request: PatientRequest
    candidates: List[NurseProfile]

@app.get("/health")
def health_check():
    return {"status": "ML recommendation service is healthy"}

@app.post("/recommend")
def recommend_nurses(data: RecommendationRequest):
    try:
        # Convert Pydantic models back to standard dictionaries for the matcher logic
        patient_dict = data.patient_request.model_dump()
        nurses_list = [n.model_dump() for n in data.candidates]
        
        ranked_results = matcher.rank_nurses(patient_dict, nurses_list)
        return {"recommendations": ranked_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML Service Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
