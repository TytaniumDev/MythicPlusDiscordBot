from dataclasses import dataclass, field
from types import NotImplementedType
from typing import Any

from .config import (
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


@dataclass(frozen=True, eq=False)
class WoWPlayer:
    name: str
    discordId: str = ""
    # Main roles
    tankMain: bool = False
    healerMain: bool = False
    dpsMain: bool = False

    # Offspecs
    offtank: bool = False
    offhealer: bool = False
    offdps: bool = False
    offranged: bool = False
    offmelee: bool = False

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
    def create(cls, name: str, roles: list[str], discord_id: str = "") -> "WoWPlayer":
        # Calculate all the boolean flags
        tankMain = ROLE_TANK in roles
        healerMain = ROLE_HEALER in roles
        ranged = ROLE_RANGED in roles
        melee = ROLE_MELEE in roles
        dpsMain = ranged or melee
        offtank = ROLE_TANK_OFFSPEC in roles
        offhealer = ROLE_HEALER_OFFSPEC in roles
        offranged = ROLE_RANGED_OFFSPEC in roles
        offmelee = ROLE_MELEE_OFFSPEC in roles
        offdps = offranged or offmelee
        hasBrez = ROLE_BREZ in roles
        hasLust = ROLE_LUST in roles

        # Create the instance with all flags set
        return cls(
            name=name,
            discordId=discord_id,
            tankMain=tankMain,
            healerMain=healerMain,
            dpsMain=dpsMain,
            offtank=offtank,
            offhealer=offhealer,
            offdps=offdps,
            offranged=offranged,
            offmelee=offmelee,
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
        if self.ranged:
            roles.append(ROLE_RANGED)
        if self.melee:
            roles.append(ROLE_MELEE)
        if self.offtank:
            roles.append(ROLE_TANK_OFFSPEC)
        if self.offhealer:
            roles.append(ROLE_HEALER_OFFSPEC)
        if self.offranged:
            roles.append(ROLE_RANGED_OFFSPEC)
        if self.offmelee:
            roles.append(ROLE_MELEE_OFFSPEC)
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

    def to_dict(self) -> dict[str, Any]:
        """Serializable dictionary representation for Firestore."""
        return {
            "name": self.name,
            "discordId": self.discordId,
            "roles": {
                "tankMain": self.tankMain,
                "healerMain": self.healerMain,
                "dpsMain": self.dpsMain,
                "offtank": self.offtank,
                "offhealer": self.offhealer,
                "offdps": self.offdps,
                "offranged": self.offranged,
                "offmelee": self.offmelee,
                "ranged": self.ranged,
                "melee": self.melee,
                "hasBrez": self.hasBrez,
                "hasLust": self.hasLust,
            },
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "WoWPlayer":
        """Reconstructs a WoWPlayer from a Firestore dictionary."""
        roles_data = data.get("roles", {})
        return cls(
            name=data["name"],
            discordId=data.get("discordId", ""),
            tankMain=roles_data.get("tankMain", False),
            healerMain=roles_data.get("healerMain", False),
            dpsMain=roles_data.get("dpsMain", False),
            offtank=roles_data.get("offtank", False),
            offhealer=roles_data.get("offhealer", False),
            offdps=roles_data.get("offdps", False),
            offranged=roles_data.get("offranged", False),
            offmelee=roles_data.get("offmelee", False),
            ranged=roles_data.get("ranged", False),
            melee=roles_data.get("melee", False),
            hasBrez=roles_data.get("hasBrez", False),
            hasLust=roles_data.get("hasLust", False),
        )


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
        return self.tank is not None and self.healer is not None and len(self.dps) == 3

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

    def to_dict(self) -> dict[str, Any]:
        """Serializable dictionary representation for Firestore."""
        return {
            "tank": self.tank.to_dict() if self.tank else None,
            "healer": self.healer.to_dict() if self.healer else None,
            "dps": [p.to_dict() for p in self.dps] if self.dps else [],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "WoWGroup":
        """Reconstructs a WoWGroup from a Firestore dictionary."""
        tank_data = data.get("tank")
        healer_data = data.get("healer")
        dps_data = data.get("dps", [])
        return cls(
            tank=WoWPlayer.from_dict(tank_data) if tank_data else None,
            healer=WoWPlayer.from_dict(healer_data) if healer_data else None,
            dps=[WoWPlayer.from_dict(p) for p in dps_data],
        )
