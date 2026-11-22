"""Run: python -m unittest discover -s tests -t ."""

import unittest
from unittest import mock

from shapely.geometry import box

import backend.main as main
from backend.demo import OCCUPIED_SHARE, demo_garages, demo_occupancy
from shared.schemas import AnalyzeRequest
from vision.detector import StubDetector

SAMPLE_LOT = {
    "type": "Polygon",
    "coordinates": [[
        [-96.7546, 32.9927], [-96.7540, 32.9927], [-96.7540, 32.9922],
        [-96.7546, 32.9922], [-96.7546, 32.9927],
    ]],
}


class OccupancyLogic(unittest.TestCase):
    def test_no_detections_is_uncertain_not_free(self):
        self.assertEqual(main._is_occupied(box(0, 0, 4, 4), []), (None, 0.0))

    def test_overlapping_detection_is_occupied(self):
        occupied, conf = main._is_occupied(box(0, 0, 4, 4), [{"polygon": box(1, 1, 4, 4), "confidence": 0.9}])
        self.assertIs(occupied, True)
        self.assertEqual(conf, 0.9)

    def test_distant_detection_is_free(self):
        occupied, _ = main._is_occupied(box(0, 0, 4, 4), [{"polygon": box(50, 50, 54, 54), "confidence": 0.9}])
        self.assertIs(occupied, False)


class DemoData(unittest.TestCase):
    def test_deterministic_within_a_tick(self):
        self.assertEqual(demo_occupancy("lot-19-cell-3", now=1000.0), demo_occupancy("lot-19-cell-3", now=1001.0))

    def test_fill_rate_is_realistic_and_mixed(self):
        results = [demo_occupancy(f"cell-{i}", now=0.0)[0] for i in range(219)]
        share = sum(results) / len(results)
        self.assertLess(abs(share - OCCUPIED_SHARE), 0.1)

    def test_garage_counts_move_over_time(self):
        self.assertNotEqual(demo_garages(now=0.0), demo_garages(now=600.0))


class AnalyzeEndpoint(unittest.TestCase):
    def test_real_mode_with_no_detections_is_all_uncertain(self):
        with mock.patch.object(main, "DEMO_MODE", False), mock.patch.object(main, "_detector", StubDetector()):
            res = main.analyze(AnalyzeRequest(geometry=SAMPLE_LOT))
        self.assertFalse(res.is_demo)
        self.assertEqual(len(res.spots), 219)
        self.assertEqual(res.detected_vehicles, 0)
        self.assertTrue(all(s.occupied is None for s in res.spots))

    def test_demo_mode_is_mixed_and_labelled_simulated(self):
        with mock.patch.object(main, "DEMO_MODE", True):
            res = main.analyze(AnalyzeRequest(geometry=SAMPLE_LOT))
        self.assertTrue(res.is_demo)
        self.assertIn("SIMULATED", res.imagery_source)
        self.assertEqual(len(res.spots), 219)
        self.assertEqual({s.occupied for s in res.spots}, {True, False})
        self.assertEqual(res.detected_vehicles, sum(s.occupied is True for s in res.spots))

    def test_invalid_geometry_rejected(self):
        with self.assertRaises(main.HTTPException):
            main.analyze(AnalyzeRequest(geometry={"type": "Point", "coordinates": [0, 0]}))


if __name__ == "__main__":
    unittest.main()
