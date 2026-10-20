import unittest

import pandas as pd

from app import dataframe_from_csv_text, load_sample_dataframe, sort_dataframe


class SortDatasetTests(unittest.TestCase):
    def test_ascending_numeric_sort(self):
        frame = pd.DataFrame({"score": [14, 2, 9]})
        result, columns, ascending = sort_dataframe(frame, [{"column": "score", "direction": "asc"}])
        self.assertEqual(result["score"].tolist(), [2, 9, 14])
        self.assertEqual(columns, ["score"])
        self.assertEqual(ascending, [True])

    def test_descending_numeric_sort(self):
        frame = pd.DataFrame({"score": [14, 2, 9]})
        result, _, _ = sort_dataframe(frame, [{"column": "score", "direction": "desc"}])
        self.assertEqual(result["score"].tolist(), [14, 9, 2])

    def test_multiple_columns_mixed_directions(self):
        frame = pd.DataFrame({"team": ["B", "A", "A", "B"], "score": [3, 4, 9, 8]})
        result, _, _ = sort_dataframe(frame, [
            {"column": "team", "direction": "asc"},
            {"column": "score", "direction": "desc"},
        ])
        self.assertEqual(list(zip(result["team"], result["score"])), [("A", 9), ("A", 4), ("B", 8), ("B", 3)])

    def test_duplicate_rules_are_rejected(self):
        frame = pd.DataFrame({"score": [2, 1]})
        with self.assertRaisesRegex(ValueError, "used more than once"):
            sort_dataframe(frame, [
                {"column": "score", "direction": "asc"},
                {"column": "score", "direction": "desc"},
            ])

    def test_csv_parser_and_sample_dataset(self):
        frame = dataframe_from_csv_text("name,score\nAsha,8\nDev,10\n")
        self.assertEqual(frame.shape, (2, 2))
        employees = load_sample_dataframe("employees")
        self.assertGreater(len(employees), 0)
        self.assertIn("Salary", employees.columns)


if __name__ == "__main__":
    unittest.main()
