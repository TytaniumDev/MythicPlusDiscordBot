import os
import sys
import unittest

# Add the parent directory to the Python path so we can import our modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.models import WoWGroup, WoWPlayer
from core.parallel_group_creator import (
    clear,
    create_mythic_plus_groups,
    set_last_groups,
)
from tests.prebuilt_classes import (
    BalanceDruid,
    FeralDruid,
    HealerDruid,
    HealerPriest,
    Mage,
    Paladin,
    TankDeathKnight,
    TankPaladin,
    TankWarrior,
    Warrior,
)


class TestGroupCreator(unittest.TestCase):
    def setUp(self):
        clear()
        # Real examples
        self.cynoc = WoWPlayer.create("Cynoc", ["Tank", "Melee Offspec"])
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

    def tearDown(self):
        clear()

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

    def test_weird_remainder_groups(self):
        """Test that it can handle lots of remainders"""
        # 13 players, should have 2 complete groups and one with 3 players
        players = [
            TankWarrior("Tank1"),
            TankWarrior("Tank2"),
            TankWarrior("Tank3"),
            TankWarrior("Tank4"),
            HealerDruid("Healer1"),
            Mage("Mage1"),
            Mage("Mage2"),
            Warrior("Warrior1"),
            Warrior("Warrior3"),
            Warrior("Warrior5"),
            Warrior("Warrior2"),
            FeralDruid("Feral1", offhealer=True),
            FeralDruid("Feral2"),
        ]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 4, "Should form 4 groups")
        self.assertEqual(groups[2].size, 1, "Second to last group should have 1 player")
        self.assertEqual(groups[3].size, 2, "Last group should have 2 players")

    def test_avoids_old_teammates_when_possible(self):
        """Test that group creator prefers fresh teammates over old ones."""
        # Setup players: 1 Tank, 1 Healer, 3 Old DPS, 3 Fresh DPS
        tank = TankWarrior("Tank")
        healer = HealerPriest("Healer")
        dps1 = Warrior("DPS1")
        dps2 = Warrior("DPS2")
        dps3 = Warrior("DPS3")
        dps4 = Warrior("DPS4")  # Fresh
        dps5 = Warrior("DPS5")  # Fresh
        dps6 = Warrior("DPS6")  # Fresh

        # Setup History: Tank played with DPS1, DPS2, DPS3
        # We manually construct lastGroups to simulate history
        g1 = WoWGroup()
        g1.tank = tank
        g1.dps = [dps1, dps2, dps3]
        # Healer was not in this group, so Healer is fresh to everyone

        # Inject the history (keyed by guild_id=None for tests)
        set_last_groups([g1])

        # Now run creation with all players available
        # The algorithm should form 1 complete group (8 players -> 1 group)
        # It needs Tank + Healer + 3 DPS.
        # It should prefer the fresh DPS (4, 5, 6) over the old teammates (1, 2, 3).
        all_players = [tank, healer, dps1, dps2, dps3, dps4, dps5, dps6]

        groups = create_mythic_plus_groups(all_players)

        # Should have at least 1 group (maybe a remainder group too)
        self.assertGreaterEqual(len(groups), 1)
        group = groups[0]

        # Verify specific composition
        self.assertEqual(group.tank, tank)
        self.assertEqual(group.healer, healer)

        # Verify it chose the fresh DPS
        dps_names = {p.name for p in group.dps}
        expected_fresh_dps = {"DPS4", "DPS5", "DPS6"}

        # Check intersection with expected fresh DPS
        # We expect ALL 3 fresh DPS to be chosen because there are exactly 3 spots
        # and exactly 3 fresh candidates who have no history with the Tank.
        intersection = dps_names.intersection(expected_fresh_dps)
        self.assertEqual(
            len(intersection),
            3,
            f"Expected fresh DPS {expected_fresh_dps}, but got {dps_names}. "
            "The algorithm should prioritize players who haven't played with the tank recently.",
        )


if __name__ == "__main__":
    unittest.main()
