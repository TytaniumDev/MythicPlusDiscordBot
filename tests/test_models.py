import os
import sys
import unittest
from typing import Any

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config import (
    ROLE_BREZ,
    ROLE_HEALER,
    ROLE_HEALER_OFFSPEC,
    ROLE_LUST,
    ROLE_MELEE,
    ROLE_MELEE_OFFSPEC,
    ROLE_RANGED,
    ROLE_RANGED_OFFSPEC,
    ROLE_TANK,
    ROLE_TANK_OFFSPEC,
)
from core.models import WoWGroup, WoWPlayer


class TestWoWPlayer(unittest.TestCase):
    def test_create_tank(self):
        player = WoWPlayer.create("TankPlayer", [ROLE_TANK])
        self.assertTrue(player.tankMain)
        self.assertFalse(player.healerMain)
        self.assertFalse(player.dpsMain)

    def test_create_healer(self):
        player = WoWPlayer.create("HealerPlayer", [ROLE_HEALER])
        self.assertFalse(player.tankMain)
        self.assertTrue(player.healerMain)
        self.assertFalse(player.dpsMain)

    def test_create_dps_variations(self):
        # Ranged DPS
        p2 = WoWPlayer.create("RangedPlayer", [ROLE_RANGED])
        self.assertTrue(p2.dpsMain)
        self.assertTrue(p2.ranged)
        self.assertFalse(p2.melee)

        # Melee DPS
        p3 = WoWPlayer.create("MeleePlayer", [ROLE_MELEE])
        self.assertTrue(p3.dpsMain)
        self.assertTrue(p3.melee)
        self.assertFalse(p3.ranged)

    def test_create_offspecs(self):
        player = WoWPlayer.create(
            "OffspecPlayer",
            [ROLE_TANK_OFFSPEC, ROLE_HEALER_OFFSPEC, ROLE_RANGED_OFFSPEC],
        )
        self.assertTrue(player.offtank)
        self.assertTrue(player.offhealer)
        self.assertTrue(player.offdps)
        self.assertTrue(player.offranged)

    def test_create_offspec_melee(self):
        player = WoWPlayer.create("OffMelee", [ROLE_MELEE_OFFSPEC])
        self.assertTrue(player.offdps)
        self.assertTrue(player.offmelee)
        self.assertFalse(player.offranged)

    def test_create_utilities(self):
        player = WoWPlayer.create("UtilPlayer", [ROLE_BREZ, ROLE_LUST])
        self.assertTrue(player.hasBrez)
        self.assertTrue(player.hasLust)

    def test_has_roles(self):
        p1 = WoWPlayer.create("NoRole", [])
        self.assertFalse(p1.hasRoles())

        p2 = WoWPlayer.create("HasRole", [ROLE_TANK])
        self.assertTrue(p2.hasRoles())

        p3 = WoWPlayer.create("OffspecOnly", [ROLE_MELEE_OFFSPEC])
        self.assertTrue(p3.hasRoles())

    def test_serialization(self):
        original = WoWPlayer.create("TestPlayer", [ROLE_TANK, ROLE_BREZ])
        data = original.to_dict()
        restored = WoWPlayer.from_dict(data)

        self.assertEqual(original.name, restored.name)
        self.assertEqual(original.tankMain, restored.tankMain)
        self.assertEqual(original.hasBrez, restored.hasBrez)
        self.assertEqual(original, restored)


class TestWoWGroup(unittest.TestCase):
    def setUp(self):
        self.tank = WoWPlayer.create("Tank", [ROLE_TANK])
        self.healer = WoWPlayer.create("Healer", [ROLE_HEALER])
        self.dps1 = WoWPlayer.create("DPS1", [ROLE_MELEE])
        self.dps2 = WoWPlayer.create("DPS2", [ROLE_RANGED])  # Ranged
        self.dps3 = WoWPlayer.create("DPS3", [ROLE_MELEE, ROLE_BREZ])  # Melee + Brez
        self.lust_player = WoWPlayer.create("LustPlayer", [ROLE_RANGED, ROLE_LUST])

    def test_group_properties(self):
        group = WoWGroup(
            tank=self.tank, healer=self.healer, dps=[self.dps1, self.dps2, self.dps3]
        )

        self.assertTrue(group.is_complete)
        self.assertEqual(group.size, 5)
        self.assertTrue(group.has_brez)  # from dps3
        self.assertTrue(group.has_ranged)  # from dps2
        self.assertFalse(group.has_lust)

    def test_group_incomplete(self):
        group = WoWGroup(tank=self.tank, healer=self.healer, dps=[self.dps1])
        self.assertFalse(group.is_complete)
        self.assertEqual(group.size, 3)

    def test_group_lust(self):
        group = WoWGroup(
            tank=self.tank,
            healer=self.healer,
            dps=[self.dps1, self.dps2, self.lust_player],
        )
        self.assertTrue(group.has_lust)

    def test_serialization(self):
        group = WoWGroup(tank=self.tank, healer=self.healer, dps=[self.dps1])
        data = group.to_dict()

        self.assertEqual(data["tank"]["name"], "Tank")
        self.assertEqual(data["healer"]["name"], "Healer")
        self.assertEqual(len(data["dps"]), 1)
        self.assertEqual(data["dps"][0]["name"], "DPS1")

    def test_round_trip_serialization(self):
        group = WoWGroup(
            tank=self.tank, healer=self.healer, dps=[self.dps1, self.dps2, self.dps3]
        )
        data = group.to_dict()
        restored = WoWGroup.from_dict(data)

        self.assertEqual(restored.tank, group.tank)
        self.assertEqual(restored.healer, group.healer)
        self.assertEqual(len(restored.dps), 3)
        for orig, rest in zip(group.dps, restored.dps, strict=True):
            self.assertEqual(orig, rest)
        self.assertEqual(restored.has_brez, group.has_brez)
        self.assertEqual(restored.has_lust, group.has_lust)

    def test_from_dict_missing_roles(self):
        """from_dict handles None tank/healer and empty dps."""
        data: dict[str, Any] = {"tank": None, "healer": None, "dps": []}
        restored = WoWGroup.from_dict(data)

        self.assertIsNone(restored.tank)
        self.assertIsNone(restored.healer)
        self.assertEqual(restored.dps, [])


if __name__ == "__main__":
    unittest.main()
