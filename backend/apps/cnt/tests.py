from django.test import SimpleTestCase

from apps.legacy.repositories.cnt_repo import _norm_fecha


class NormFechaTests(SimpleTestCase):
    def test_iso_date_passthrough(self):
        self.assertEqual(_norm_fecha('2026-10-15'), '2026-10-15')

    def test_strips_time_suffix(self):
        self.assertEqual(_norm_fecha('2026-10-15T00:00:00.000Z'), '2026-10-15')

    def test_empty_returns_none(self):
        self.assertIsNone(_norm_fecha(''))
        self.assertIsNone(_norm_fecha(None))

    def test_invalid_raises_value_error(self):
        with self.assertRaises(ValueError):
            _norm_fecha('15/10/2026')
        with self.assertRaises(ValueError):
            _norm_fecha('not-a-date')
