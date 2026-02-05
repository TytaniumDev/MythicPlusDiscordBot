from dataclasses import dataclass, field
from types import NotImplementedType

from .config import (
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

    def __eq__(self, other: object) -> bool | NotImplementedType:
        if not isinstance(other, WoWPlayer):
            return NotImplemented
        return self.name == other.name

    def __str__(self):
        return self.name

    def __repr__(self):
        return self.__str__()

    @classmethod
    def create(cls, name: str, roles: list[str]) -> "WoWPlayer":
        # Calculate all the boolean flags
        tankMain = ROLE_TANK in roles
        healerMain = ROLE_HEALER in roles
        dpsMain = any(role in roles for role in [ROLE_DPS, ROLE_RANGED, ROLE_MELEE])
        offtank = ROLE_TANK_OFFSPEC in roles
        offhealer = ROLE_HEALER_OFFSPEC in roles
        offdps = ROLE_DPS_OFFSPEC in roles
        ranged = ROLE_RANGED in roles
        melee = ROLE_MELEE in roles
        hasBrez = ROLE_BREZ in roles
        hasLust = ROLE_LUST in roles

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

    def hasRoles(self) -> bool:
        return any(
            [
                self.tankMain,
                self.healerMain,
                self.dpsMain,
                self.offtank,
                self.offhealer,
                self.offdps,
            ]
        )

    def toTestString(self) -> str:
        roles = []
        if self.tankMain:
            roles.append(ROLE_TANK)
        if self.healerMain:
            roles.append(ROLE_HEALER)
        if self.dpsMain:
            roles.append(ROLE_DPS)
        if self.offtank:
            roles.append(ROLE_TANK_OFFSPEC)
        if self.offhealer:
            roles.append(ROLE_HEALER_OFFSPEC)
        if self.offdps:
            roles.append(ROLE_DPS_OFFSPEC)
        if self.ranged:
            roles.append(ROLE_RANGED)
        if self.melee:
            roles.append(ROLE_MELEE)
        if self.hasBrez:
            roles.append(ROLE_BREZ)
        if self.hasLust:
            roles.append(ROLE_LUST)
        return f'WoWPlayer.create("{self.name}", {roles})'

    def toUtilitiesString(self) -> str:
        utilities = []
        if self.hasBrez:
            utilities.append(ROLE_BREZ)
        if self.hasLust:
            utilities.append(ROLE_LUST)
        if utilities:
            return f"{self.name}({', '.join(utilities)})"
        return self.name

    def to_dict(self) -> dict:
        """Serializable dictionary representation for Firestore."""
        return {
            "name": self.name,
            "roles": {
                "tankMain": self.tankMain,
                "healerMain": self.healerMain,
                "dpsMain": self.dpsMain,
                "offtank": self.offtank,
                "offhealer": self.offhealer,
                "offdps": self.offdps,
                "ranged": self.ranged,
                "melee": self.melee,
                "hasBrez": self.hasBrez,
                "hasLust": self.hasLust,
            },
        }


@dataclass
class WoWGroup:
    tank: WoWPlayer | None = None
    healer: WoWPlayer | None = None
    dps: list[WoWPlayer] = field(default_factory=list)

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

    @property
    def players(self):
        return [p for p in [self.tank, self.healer] + self.dps if p is not None]

    def toTestString(self) -> str:
        tank_str = f'"{self.tank.toUtilitiesString()}"' if self.tank else "None"
        healer_str = f'"{self.healer.toUtilitiesString()}"' if self.healer else "None"
        dps_str = (
            ", ".join(f'"{p.toUtilitiesString()}"' for p in self.dps)
            if self.dps
            else ""
        )
        return f"WoWGroup(Tank={tank_str}, Healer={healer_str}, DPS={dps_str})"

    def to_dict(self) -> dict:
        """Serializable dictionary representation for Firestore."""
        return {
            "tank": self.tank.to_dict() if self.tank else None,
            "healer": self.healer.to_dict() if self.healer else None,
            "dps": [p.to_dict() for p in self.dps] if self.dps else [],
        }
