"""Tests der Aufbereitung ohne Netz: python -m unittest discover sync"""

import json
import unittest

from garmin_sync import build_activity, build_metrics, laps_of, latest_readiness, sport_of, stream_of

READINESS = [
    {"timestampLocal": "2026-10-18T06:40:00.0", "score": 61, "level": "MODERATE"},
    {
        "timestampLocal": "2026-10-18T09:15:00.0", "score": 78, "level": "HIGH", "feedbackShort": "WELL_RECOVERED",
        "sleepScore": 84, "sleepScoreFactorPercent": 84, "recoveryTime": 120, "recoveryTimeFactorPercent": 88,
        "hrvFactorPercent": 76, "hrvWeeklyAverage": 57, "acwrFactorPercent": 70, "acuteLoad": 400,
        "stressHistoryFactorPercent": 82, "stressHistoryFactorFeedback": "GOOD",
    },
]

STATUS = {
    "mostRecentTrainingStatus": {"latestTrainingStatusData": {"123": {
        "acuteTrainingLoadDTO": {"dailyTrainingLoadAcute": 412, "acwrStatus": "OPTIMAL"}}}},
    "mostRecentVO2Max": {"generic": {"vo2MaxPreciseValue": 50.9}},
}


class MetricsTest(unittest.TestCase):
    def test_latest_readiness_takes_newest(self):
        self.assertEqual(latest_readiness(READINESS)["score"], 78)
        self.assertIsNone(latest_readiness([]))
        self.assertIsNone(latest_readiness(None))

    def test_full_day(self):
        row = build_metrics("2026-10-18", {
            "readiness": READINESS,
            "hrv": {"hrvSummary": {"lastNightAvg": 58, "status": "BALANCED"}},
            "sleep": {"dailySleepDTO": {"sleepTimeSeconds": 27720, "sleepScores": {"overall": {"value": 84}}}},
            "summary": {"restingHeartRate": 52, "averageStressLevel": 24,
                        "bodyBatteryHighestValue": 91, "bodyBatteryLowestValue": 22},
            "max_metrics": [{"generic": {"vo2MaxPreciseValue": 51.2}}],
            "body_comp": {"dateWeightList": [{"weight": 85300.0}]},
            "training_status": STATUS,
        })
        self.assertEqual(row["readiness_score"], 78)
        self.assertEqual(row["recovery_hours"], 2.0)
        self.assertEqual(row["acute_load"], 412)
        self.assertEqual(row["vo2max"], 51.2)
        self.assertEqual(row["weight_kg"], 85.3)
        self.assertEqual(row["resting_hr"], 52)
        factors = json.loads(row["factors_json"])
        self.assertEqual([f["label"] for f in factors], ["Schlaf", "Erholungszeit", "HRV-Status", "Akute Belastung", "Stress"])
        self.assertEqual(factors[0]["value"], "7:42 h, Score 84")
        self.assertEqual(factors[1]["value"], "noch 2 h")
        self.assertEqual(factors[2]["value"], "58 ms, ausgeglichen")
        self.assertEqual(factors[3]["value"], "412, optimal")
        self.assertEqual(factors[4]["value"], "gut")

    def test_empty_day_has_no_values(self):
        row = build_metrics("2026-10-18", {"summary": {"averageStressLevel": -1}})
        self.assertIsNone(row["readiness_score"])
        self.assertIsNone(row["stress_avg"])
        self.assertIsNone(row["factors_json"])

    def test_vo2max_fallback_from_training_status(self):
        row = build_metrics("2026-10-18", {"max_metrics": [], "training_status": STATUS})
        self.assertEqual(row["vo2max"], 50.9)

    def test_resting_hr_fallback(self):
        rhr = {"allMetrics": {"metricsMap": {"WELLNESS_RESTING_HEART_RATE": [{"value": 49.0}]}}}
        self.assertEqual(build_metrics("2026-10-18", {"summary": {}, "rhr": rhr})["resting_hr"], 49)


class ActivityTest(unittest.TestCase):
    def test_run_with_zones(self):
        row = build_activity({
            "activityId": 987, "activityName": "Würzburg Laufen", "startTimeLocal": "2026-10-18 07:12:33",
            "activityType": {"typeKey": "running"}, "duration": 2790.4, "distance": 8200.12,
            "averageHR": 144.0, "maxHR": 161.0, "activityTrainingLoad": 88.36,
            "hrTimeInZone_1": 300.0, "hrTimeInZone_2": 2100.0, "hrTimeInZone_3": 390.0,
        })
        self.assertEqual(row["id"], "garmin:987")
        self.assertEqual(row["sport"], "run")
        self.assertEqual(row["start_time"], "2026-10-18T07:12:33")
        self.assertEqual(row["duration_s"], 2790)
        self.assertEqual(json.loads(row["zone_seconds_json"]), [300, 2100, 390, 0, 0])

    def test_zones_from_detail(self):
        detail = [{"zoneNumber": 2, "secsInZone": 1200.5}, {"zoneNumber": 4, "secsInZone": 60}]
        row = build_activity({"activityId": 1, "startTimeLocal": "2026-10-18 18:00:00",
                              "activityType": {"typeKey": "indoor_cycling"}}, detail)
        self.assertEqual(row["sport"], "bike")
        self.assertEqual(json.loads(row["zone_seconds_json"]), [0, 1200, 0, 60, 0])

    def test_sports(self):
        self.assertEqual(sport_of("strength_training"), "strength")
        self.assertEqual(sport_of("lap_swimming"), "swim")
        self.assertEqual(sport_of("padel"), "padel")
        self.assertEqual(sport_of("trail_running"), "run")
        self.assertEqual(sport_of("yoga"), "other")
        self.assertEqual(sport_of(None), "other")

    def test_incomplete_activity_is_skipped(self):
        self.assertIsNone(build_activity({"activityName": "ohne ID"}))


class DetailTest(unittest.TestCase):
    def test_details_in_activity(self):
        row = build_activity({"activityId": 1, "startTimeLocal": "2026-10-20 18:00:00", "activityType": {"typeKey": "running"},
                              "averageSpeed": 2.8, "elevationGain": 42.0, "averageRunningCadenceInStepsPerMinute": 168.4,
                              "aerobicTrainingEffect": 2.9, "trainingEffectLabel": "AEROBIC_BASE"})
        d = json.loads(row["details_json"])
        self.assertEqual(d["avg_speed"], 2.8)
        self.assertEqual(d["cadence"], 168.4)
        self.assertEqual(d["te_label"], "AEROBIC_BASE")

    def test_laps(self):
        laps = laps_of({"lapDTOs": [
            {"distance": 1000.0, "duration": 352.1, "averageSpeed": 2.84, "averageHR": 141, "maxHR": 148,
             "averageRunCadence": 166.0, "elevationGain": 4.0, "intensityType": "ACTIVE"},
            {"distance": 0, "duration": 0},
        ]})
        self.assertEqual(len(laps), 1)
        self.assertEqual(laps[0]["hr"], 141)
        self.assertEqual(laps[0]["kind"], "ACTIVE")

    def test_stream_downsampled(self):
        desc = [{"key": "sumDuration", "metricsIndex": 0}, {"key": "directHeartRate", "metricsIndex": 1},
                {"key": "directSpeed", "metricsIndex": 2}, {"key": "directDoubleCadence", "metricsIndex": 3}]
        samples = [{"metrics": [float(i), 140 + i % 5, 2.8, 334.0]} for i in range(1000)]
        st = stream_of({"metricDescriptors": desc, "activityDetailMetrics": samples}, points=100)
        self.assertEqual(len(st["t"]), 100)
        self.assertEqual(st["cad"][0], 167)
        self.assertEqual(st["v"][0], 2.8)
        self.assertIsNone(st["alt"][0])
        self.assertIsNone(stream_of({"metricDescriptors": [], "activityDetailMetrics": []}))


if __name__ == "__main__":
    unittest.main()
