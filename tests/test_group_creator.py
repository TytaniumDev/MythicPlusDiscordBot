import os
import sys
import unittest

# Add the parent directory to the Python path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import WoWPlayer
from another_group_creator import create_mythic_plus_groups
from tests.prebuilt_classes import *


class TestGroupCreator(unittest.TestCase):
    def setUp(self):
        # Real examples
        self.cynoc = WoWPlayer.create("Cynoc", ["Tank", "DPS Offspec"])
        self.gazzi = WoWPlayer.create("Gazzi", ["Tank", "Brez"])
        self.temma = WoWPlayer.create("Temma", ["Tank", "Melee", "Brez"])
        self.moriim = WoWPlayer.create(
            "Moriim", ["Tank Offspec", "Healer Offspec", "Melee", "Ranged"]
        )
        self.testpally = TankPaladin("TestPally", offhealer=True, offdps=False)

        self.sorovar = WoWPlayer.create("Sorovar", ["Healer"])
        self.selinora = WoWPlayer.create("Selinora", ["Healer"])

        self.tytanium = WoWPlayer.create(
            "Tytanium", ["Healer Offspec", "Melee", "Brez"]
        )
        self.widdershins = WoWPlayer.create(
            "Widdershins", ["Healer Offspec", "Ranged", "Lust"]
        )
        self.bevan = WoWPlayer.create("Bevan", ["Ranged"])
        self.poppybros = WoWPlayer.create("Poppybros", ["Ranged", "Lust"])
        self.mickey = WoWPlayer.create("Mickey", ["Melee"])
        self.johng = WoWPlayer.create("John G.", ["Melee", "Brez"])
        self.justine = WoWPlayer.create("Justine", ["Melee", "Brez"])
        self.raxef = WoWPlayer.create("Raxef", ["Melee"])
        self.kat = WoWPlayer.create("Kat", ["Melee"])

    def test_real_world(self):
        """Test real world scenario"""
        players = [
            self.cynoc,
            self.gazzi,
            self.temma,
            self.moriim,
            self.sorovar,
            self.selinora,
            self.tytanium,
            self.widdershins,
            self.bevan,
            self.poppybros,
            self.mickey,
            self.johng,
            self.justine,
            self.raxef,
            self.kat,
        ]
        groups = create_mythic_plus_groups(players)

        # Verify that 3 groups are made
        self.assertEqual(len(groups), 3)

        # Verify that all groups are complete, since we have 15 players
        for group in groups:
            self.assertTrue(group.is_complete, "All groups should be complete")

        # Verify that two groups have both brez and lust
        utility_groups = []
        for group in groups:
            if group.has_brez and group.has_lust:
                utility_groups.append(group)
        self.assertGreaterEqual(
            len(utility_groups),
            2,
            "Should have at least two groups with both brez and lust",
        )

        # Verify that every group has a brez
        for group in groups:
            self.assertTrue(group.has_brez, "Every group should have a brez")

    def test_small_incomplete_group(self):
        """Test creating a small incomplete group"""
        players = [
            self.gazzi,
            self.sorovar,
            self.tytanium,
            self.poppybros,
            self.raxef,
            self.temma,
            self.johng,
        ]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_smallest_incomplete_group_dps(self):
        """Test creating a smallest incomplete group with just dps"""
        players = [
            self.gazzi,
            self.sorovar,
            self.tytanium,
            self.poppybros,
            self.raxef,
            self.johng,
        ]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_smallest_incomplete_group_tank(self):
        """Test creating a smallest incomplete group with just a tank"""
        players = [
            self.gazzi,
            self.sorovar,
            self.tytanium,
            self.poppybros,
            self.raxef,
            self.temma,
        ]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_smallest_incomplete_group_healer(self):
        """Test creating a smallest incomplete group with just a healer"""
        players = [
            self.gazzi,
            self.sorovar,
            self.tytanium,
            self.poppybros,
            self.raxef,
            self.selinora,
        ]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_utility_distribution(self):
        """Test that every group has each utility when possible"""
        players = [
            TankWarrior("Tank1"),
            TankDeathKnight("Brez1"),
            HealerDruid("Brez2"),
            HealerPriest("Healer2"),
            Mage("Lust1"),
            Mage("Lust2"),
            Warrior("Warrior1"),
            Warrior("Warrior2"),
            FeralDruid("Feral1"),
            FeralDruid("Feral2"),
        ]
        groups = create_mythic_plus_groups(players)

        # Verify that brez and lust are in the same group
        for group in groups:
            self.assertTrue(
                group.has_brez and group.has_lust,
                f"group {group} should have both brez and lust",
            )

    def test_offspec_usage(self):
        """Test that offspecs are used when main specs are exhausted"""
        players = [
            TankWarrior("Tank1"),
            Paladin("Offtank", offtank=True),
            HealerDruid("Healer1"),
            BalanceDruid("Offhealer", offhealer=True),
            Mage("Mage1"),
            Mage("Mage2"),
            Warrior("Warrior1"),
            Warrior("Warrior2"),
            FeralDruid("Feral1"),
            FeralDruid("Feral2"),
        ]
        groups = create_mythic_plus_groups(players)

        # Should form one complete group with main specs and start forming a second with offspecs
        self.assertEqual(len(groups), 2)
        for group in groups:
            self.assertTrue(group.is_complete, f"group {group} should be complete")

    def test_ranged_melee_balance(self):
        """Test that groups try to include at least one ranged DPS"""
        players = [
            TankWarrior("Tank1"),
            TankWarrior("Tank2"),
            HealerDruid("Healer1"),
            HealerDruid("Healer2"),
            Mage("Mage1"),
            Mage("Mage2"),
            Warrior("Warrior1"),
            Warrior("Warrior2"),
            FeralDruid("Feral1"),
            FeralDruid("Feral2"),
        ]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        for group in groups:
            self.assertTrue(group.has_ranged, f"group {group} should have a ranged DPS")


if __name__ == "__main__":
    unittest.main()
