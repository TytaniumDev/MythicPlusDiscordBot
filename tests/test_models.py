import os
import sys
import unittest
from typing import Any

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config import (
    ROLE_BREZ,
    ROLE_DPS,
    ROLE_DPS_OFFSPEC,
    ROLE_HEALER,
    ROLE_HEALER_OFFSPEC,
    ROLE_LUST,
    ROLE_MELEE,
    ROLE_RANGED,
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
        # Generic DPS
        p1 = WoWPlayer.create("DpsPlayer", [ROLE_DPS])
        self.assertTrue(p1.dpsMain)

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
            "OffspecPlayer", [ROLE_TANK_OFFSPEC, ROLE_HEALER_OFFSPEC, ROLE_DPS_OFFSPEC]
        )
        self.assertTrue(player.offtank)
        self.assertTrue(player.offhealer)
        self.assertTrue(player.offdps)

    def test_create_utilities(self):
        player = WoWPlayer.create("UtilPlayer", [ROLE_BREZ, ROLE_LUST])
        self.assertTrue(player.hasBrez)
        self.assertTrue(player.hasLust)

    def test_has_roles(self):
        p1 = WoWPlayer.create("NoRole", [])
        self.assertFalse(p1.hasRoles())

        p2 = WoWPlayer.create("HasRole", [ROLE_TANK])
        self.assertTrue(p2.hasRoles())

        p3 = WoWPlayer.create("OffspecOnly", [ROLE_DPS_OFFSPEC])
        self.assertTrue(p3.hasRoles())

    def test_serialization(self):
        original = WoWPlayer.create(
            "TestPlayer", [ROLE_TANK, ROLE_BREZ], discord_id="12345"
        )
        data = original.to_dict()
        restored = WoWPlayer.from_dict(data)

        self.assertEqual(original.name, restored.name)
        self.assertEqual(original.discord_id, restored.discord_id)
        self.assertEqual(original.tankMain, restored.tankMain)
        self.assertEqual(original.hasBrez, restored.hasBrez)
        self.assertEqual(original, restored)

    def test_equality_and_hash(self):
        # Same ID, different names
        p1 = WoWPlayer.create("Name1", [ROLE_TANK], discord_id="ID1")
        p2 = WoWPlayer.create("Name2", [ROLE_TANK], discord_id="ID1")
        self.assertEqual(p1, p2)
        self.assertEqual(hash(p1), hash(p2))

        # Different IDs, same names
        p3 = WoWPlayer.create("Name1", [ROLE_TANK], discord_id="ID1")
        p4 = WoWPlayer.create("Name1", [ROLE_TANK], discord_id="ID2")
        self.assertNotEqual(p3, p4)
        self.assertNotEqual(hash(p3), hash(p4))

        # No IDs, same names (fallback)
        p5 = WoWPlayer.create("Name1", [ROLE_TANK])
        p6 = WoWPlayer.create("Name1", [ROLE_TANK])
        self.assertEqual(p5, p6)
        self.assertEqual(hash(p5), hash(p6))


class TestWoWGroup(unittest.TestCase):
    def setUp(self):
        self.tank = WoWPlayer.create("Tank", [ROLE_TANK])
        self.healer = WoWPlayer.create("Healer", [ROLE_HEALER])
        self.dps1 = WoWPlayer.create("DPS1", [ROLE_DPS])
        self.dps2 = WoWPlayer.create("DPS2", [ROLE_RANGED])  # Ranged
        self.dps3 = WoWPlayer.create("DPS3", [ROLE_MELEE, ROLE_BREZ])  # Melee + Brez
        self.lust_player = WoWPlayer.create("LustPlayer", [ROLE_DPS, ROLE_LUST])

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
