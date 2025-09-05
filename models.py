from dataclasses import dataclass, field
from typing import List

@dataclass(frozen=True, eq=False)
class WoWPlayer:
    name: str
    # Main roles
    tankMain: bool = False
    healerMain: bool = False
    dpsMain: bool = False

    # Offspecs
    offtank: bool = False
    offhealer: bool = False
    offdps: bool = False

    # Types of DPS
    ranged: bool = False
    melee: bool = False

    # Utility
    hasBrez: bool = False
    hasLust: bool = False

    def __hash__(self):
        return hash(self.name)

    def __eq__(self, other):
        if not isinstance(other, WoWPlayer):
            return NotImplemented
        return self.name == other.name

    def __str__(self):
        return self.name

    def __repr__(self):
        return self.__str__()

    @classmethod
    def create(cls, name: str, roles: list) -> 'WoWPlayer':
        # Calculate all the boolean flags
        tankMain = 'Tank' in roles
        healerMain = 'Healer' in roles
        dpsMain = any(role in roles for role in ['DPS', 'Ranged', 'Melee'])
        offtank = 'Tank Offspec' in roles
        offhealer = 'Healer Offspec' in roles
        offdps = 'DPS Offspec' in roles
        ranged = 'Ranged' in roles
        melee = 'Melee' in roles
        hasBrez = 'Brez' in roles
        hasLust = 'Lust' in roles

        # Create the instance with all flags set
        return cls(
            name=name,
            tankMain=tankMain,
            healerMain=healerMain,
            dpsMain=dpsMain,
            offtank=offtank,
            offhealer=offhealer,
            offdps=offdps,
            ranged=ranged,
            melee=melee,
            hasBrez=hasBrez,
            hasLust=hasLust,
        )

    def toTestString(self) -> str:
        roles = []
        if self.tankMain:
            roles.append("Tank")
        if self.healerMain:
            roles.append("Healer")
        if self.dpsMain:
            roles.append("DPS")
        if self.offtank:
            roles.append("Tank Offspec")
        if self.offhealer:
            roles.append("Healer Offspec")
        if self.offdps:
            roles.append("DPS Offspec")
        if self.ranged:
            roles.append("Ranged")
        if self.melee:
            roles.append("Melee")
        if self.hasBrez:
            roles.append("Brez")
        if self.hasLust:
            roles.append("Lust")
        return f'WoWPlayer.create("{self.name}", {roles})'
    
    def toUtilitiesString(self) -> str:
        utilities = []
        if self.hasBrez:
            utilities.append("Brez")
        if self.hasLust:
            utilities.append("Lust")
        if utilities:
            return f'{self.name}({", ".join(utilities)})'
        return self.name


@dataclass
class WoWGroup:
    tank: WoWPlayer = None
    healer: WoWPlayer = None
    dps: List[WoWPlayer] = field(default_factory=list)

    @property
    def has_brez(self):
        return any(p and p.hasBrez for p in [self.tank, self.healer] + self.dps)

    @property
    def has_lust(self):
        return any(p and p.hasLust for p in [self.tank, self.healer] + self.dps)

    @property
    def has_ranged(self):
        return any(p and p.ranged for p in [self.tank, self.healer] + self.dps)

    @property
    def is_complete(self):
        return all(p is not None for p in [self.tank, self.healer] + self.dps)

    @property
    def size(self):
        return sum(1 for p in [self.tank, self.healer] + self.dps if p is not None)
    
    def toTestString(self) -> str:
        tank_str = f'"{self.tank.toUtilitiesString()}"' if self.tank else 'None'
        healer_str = f'"{self.healer.toUtilitiesString()}"' if self.healer else 'None'
        dps_str = ', '.join(f'"{p.toUtilitiesString()}"' for p in self.dps) if self.dps else ''
        return f'WoWGroup(Tank={tank_str}, Healer={healer_str}, DPS={dps_str})'
    
