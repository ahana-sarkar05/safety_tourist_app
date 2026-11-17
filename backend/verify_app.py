import sys
from pathlib import Path
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from api.main import app

def test_all_endpoints():
    with TestClient(app) as client:
        print("Testing GET /health ...")
        r = client.get("/health")
        assert r.status_code == 200, f"Health status {r.status_code}: {r.text}"
        data = r.json()
        print("Health OK:", data)

        print("\nTesting GET /safety-score ...")
        r = client.get("/safety-score?lat=9.9312&lon=76.2673")
        assert r.status_code == 200, f"Safety score status {r.status_code}: {r.text}"
        score_data = r.json()
        print("Safety Score OK:", score_data)
        assert 0 <= score_data["score"] <= 100
        assert score_data["label"] in ["Safe", "Caution", "Avoid"]

        print("\nTesting GET /places ...")
        r = client.get("/places?limit=5")
        assert r.status_code == 200
        places = r.json()
        print(f"Places OK: got {len(places)} places")

        print("\nTesting GET /places/safest ...")
        r = client.get("/places/safest?lat=9.9312&lon=76.2673&radius_km=25")
        assert r.status_code == 200
        safest = r.json()
        print(f"Safest places OK: got {len(safest)} places")

        print("\nTesting POST /trip ...")
        r = client.post("/trip", json={
            "city": "Kochi",
            "interests": ["historical", "beach"],
            "lat": 9.9312,
            "lon": 76.2673,
            "sort_by": "safety"
        })
        assert r.status_code == 200, f"Trip error {r.status_code}: {r.text}"
        trip_data = r.json()
        print(f"Trip OK: {trip_data['total']} destinations ranked")
        if trip_data["destinations"]:
            d0 = trip_data["destinations"][0]
            print(f"  Top destination: {d0['name']} (Score: {d0['score']}, {d0['label']})")

        print("\nTesting POST /incidents/report ...")
        r = client.post("/incidents/report", json={
            "incident_type": "THEFT",
            "description": "Bag stolen from scooter near jetty",
            "lat": 9.9668,
            "lon": 76.2420
        })
        assert r.status_code == 201, f"Report incident error {r.status_code}: {r.text}"
        print("Report Incident OK:", r.json())

        print("\nTesting GET /incidents ...")
        r = client.get("/incidents?hours=48")
        assert r.status_code == 200
        incidents = r.json()
        print(f"Incidents feed OK: {len(incidents)} incidents retrieved")

        print("\nTesting GET / (Frontend) ...")
        r = client.get("/")
        assert r.status_code == 200
        assert "<title>Tourist Safety" in r.text
        print("Frontend served successfully!")

    print("\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all_endpoints()
