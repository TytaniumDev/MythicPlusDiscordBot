import unittest
from models import WoWPlayer
from group_creator import create_mythic_plus_groups

class TestGroupCreator(unittest.TestCase):
    def setUp(self):
        # Create some test players with different roles
        self.tank1 = WoWPlayer.create("Tank1", ["Tank"])
        self.tank2 = WoWPlayer.create("Tank2", ["Tank"])
        self.offtank = WoWPlayer.create("OffTank", ["DPS", "Tank Offspec"])
        
        self.healer1 = WoWPlayer.create("Healer1", ["Healer"])
        self.healer2 = WoWPlayer.create("Healer2", ["Healer"])
        self.offhealer = WoWPlayer.create("OffHealer", ["DPS", "Healer Offspec"])
        
        self.dps1 = WoWPlayer.create("DPS1", ["DPS", "Ranged"])
        self.dps2 = WoWPlayer.create("DPS2", ["DPS", "Melee"])
        self.dps3 = WoWPlayer.create("DPS3", ["DPS", "Ranged"])
        self.dps4 = WoWPlayer.create("DPS4", ["DPS", "Melee"])
        self.dps5 = WoWPlayer.create("DPS5", ["DPS", "Ranged", "Brez"])
        self.dps6 = WoWPlayer.create("DPS6", ["DPS", "Melee", "Lust"])

        # Real examples
        self.cynoc = WoWPlayer.create("Cynoc", ["Tank", "DPS Offspec"])
        self.gazzi = WoWPlayer.create("Gazzi", ["Tank", "Brez"])
        self.temma = WoWPlayer.create("Temma", ["Tank", "Melee", "Brez"])
        self.moriim = WoWPlayer.create("Moriim", ["Tank Offspec", "Healer Offspec", "Melee", "Ranged"])

        self.sorovar = WoWPlayer.create("Sorovar", ["Healer"])
        self.selinora = WoWPlayer.create("Selinora", ["Healer"])

        self.tytanium = WoWPlayer.create("Tytanium", ["Healer Offspec", "Melee", "Brez"])
        self.widdershins = WoWPlayer.create("Widdershins", ["Healer Offspec", "Ranged", "Lust"])
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
            self.cynoc, self.gazzi, self.temma, self.moriim,
            self.sorovar, self.selinora, self.tytanium, self.widdershins,
            self.bevan, self.poppybros, self.mickey, self.johng,
            self.justine, self.raxef, self.kat
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
        self.assertGreaterEqual(len(utility_groups), 2, "Should have at least two groups with both brez and lust")

        # Verify that every group has a brez
        for group in groups:
            self.assertTrue(group.has_brez, "Every group should have a brez")

    def test_small_incomplete_group(self):
        """Test creating a small incomplete group"""
        players = [self.gazzi, self.sorovar, self.tytanium, self.poppybros, self.raxef, self.temma, self.johng,]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_smallest_incomplete_group_dps(self):
        """Test creating a smallest incomplete group with just dps"""
        players = [self.gazzi, self.sorovar, self.tytanium, self.poppybros, self.raxef, self.johng,]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_smallest_incomplete_group_tank(self):
        """Test creating a smallest incomplete group with just a tank"""
        players = [self.gazzi, self.sorovar, self.tytanium, self.poppybros, self.raxef, self.temma,]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_smallest_incomplete_group_healer(self):
        """Test creating a smallest incomplete group with just a healer"""
        players = [self.gazzi, self.sorovar, self.tytanium, self.poppybros, self.raxef, self.selinora,]
        groups = create_mythic_plus_groups(players)

        self.assertEqual(len(groups), 2)
        self.assertTrue(groups[0].is_complete)

    def test_perfect_group_formation(self):
        """Test creating a perfect group with tank, healer, and 3 DPS"""
        players = [self.tank1, self.healer1, self.dps1, self.dps2, self.dps3]
        groups = create_mythic_plus_groups(players)
        
        self.assertEqual(len(groups), 1)
        group = groups[0]
        
        # Verify group composition
        self.assertEqual(group.tank.name, "Tank1")
        self.assertEqual(group.healer.name, "Healer1")
        self.assertTrue(group.is_complete)
        self.assertEqual(group.size, 5)

    def test_multiple_complete_groups(self):
        """Test creating multiple complete groups"""
        players = [
            self.tank1, self.tank2,
            self.healer1, self.healer2,
            self.dps1, self.dps2, self.dps3,
            self.dps4, self.dps5, self.dps6
        ]
        groups = create_mythic_plus_groups(players)
        
        self.assertEqual(len(groups), 2)
        for group in groups:
            self.assertTrue(group.is_complete)
            self.assertEqual(group.size, 5)

    def test_utility_distribution(self):
        """Test that utilities (brez/lust) are placed in the same group to maximize group effectiveness"""
        players = [
            self.tank1, self.tank2,
            self.healer1, self.healer2,
            self.dps1, self.dps2, self.dps3,
            self.dps4, self.dps5, self.dps6  # dps5 has brez, dps6 has lust
        ]
        groups = create_mythic_plus_groups(players)
        
        # Verify that brez and lust are in the same group
        utility_group = None
        for i, group in enumerate(groups):
            if group.has_brez or group.has_lust:
                utility_group = i
                # This group should have both utilities
                self.assertTrue(group.has_brez and group.has_lust,
                              "The utility group should have both battle res and bloodlust")
            else:
                # The other group should have no utilities
                self.assertFalse(group.has_brez or group.has_lust,
                               "Non-utility groups should not have battle res or bloodlust")
        
        self.assertIsNotNone(utility_group, "Should have one group with both utilities")

    def test_incomplete_group_handling(self):
        """Test handling of groups when there aren't enough players for complete groups"""
        players = [self.tank1, self.healer1, self.dps1, self.dps2]  # Only 4 players
        groups = create_mythic_plus_groups(players)
        
        self.assertEqual(len(groups), 1)
        group = groups[0]
        self.assertEqual(group.size, 4)
        self.assertFalse(group.is_complete)

    def test_offspec_usage(self):
        """Test that offspecs are used when main specs are exhausted"""
        players = [
            self.tank1,
            self.healer1,
            self.offtank,  # DPS with tank offspec
            self.offhealer,  # DPS with healer offspec
            self.dps1,
            self.dps2,
            self.dps3,
            self.dps4
        ]
        groups = create_mythic_plus_groups(players)
        
        # Should form one complete group with main specs and start forming a second with offspecs
        self.assertTrue(len(groups) >= 1)
        self.assertTrue(groups[0].is_complete)

    def test_ranged_melee_balance(self):
        """Test that groups try to include at least one ranged DPS"""
        players = [
            self.tank1,
            self.healer1,
            self.dps1,  # Ranged
            self.dps2,  # Melee
            self.dps4   # Melee
        ]
        groups = create_mythic_plus_groups(players)
        
        self.assertEqual(len(groups), 1)
        group = groups[0]
        self.assertTrue(group.has_ranged)

if __name__ == '__main__':
    unittest.main()
