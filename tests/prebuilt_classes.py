from models import WoWPlayer


### Tanks
def TankPaladin(name: str, offhealer=False, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        tankMain=True,
        hasBrez=True,
        hasLust=False,
        offhealer=offhealer,
        offdps=offdps,
    )


def TankWarrior(name: str, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name, tankMain=True, hasBrez=False, hasLust=False, offdps=offdps
    )


def TankDruid(name: str, offhealer=False, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        tankMain=True,
        hasBrez=True,
        hasLust=False,
        offhealer=offhealer,
        offdps=offdps,
    )


def TankDeathKnight(name: str, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name, tankMain=True, hasBrez=True, hasLust=False, offdps=offdps
    )


def TankMonk(name: str, offhealer=False, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        tankMain=True,
        hasBrez=False,
        hasLust=False,
        offhealer=offhealer,
        offdps=offdps,
    )


def TankDemonHunter(name: str, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name, tankMain=True, hasBrez=False, hasLust=False, offdps=offdps
    )


### Healers
def HealerPaladin(name: str, offtank=False, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        healerMain=True,
        hasBrez=True,
        hasLust=False,
        offtank=offtank,
        offdps=offdps,
    )


def HealerPriest(name: str, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name, healerMain=True, hasBrez=False, hasLust=False, offdps=offdps
    )


def HealerShaman(name: str, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name, healerMain=True, hasBrez=False, hasLust=True, offdps=offdps
    )


def HealerDruid(name: str, offtank=False, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        healerMain=True,
        hasBrez=True,
        hasLust=False,
        offtank=offtank,
        offdps=offdps,
    )


def HealerEvoker(name: str, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name, healerMain=True, hasBrez=False, hasLust=True, offdps=offdps
    )


def HealerMonk(name: str, offtank=False, offdps=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        healerMain=True,
        hasBrez=False,
        hasLust=False,
        offtank=offtank,
        offdps=offdps,
    )


### DPS
def DeathKnight(
    name: str,
    offtank=False,
) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        melee=True,
        hasBrez=True,
        hasLust=False,
        offtank=offtank,
    )


def DemonHunter(
    name: str,
    offtank=False,
) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        melee=True,
        hasBrez=False,
        hasLust=False,
        offtank=offtank,
    )


def BalanceDruid(name: str, offtank=False, offhealer=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        ranged=True,
        hasBrez=True,
        hasLust=False,
        offhealer=offhealer,
        offtank=offtank,
    )


def FeralDruid(name: str, offtank=False, offhealer=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        melee=True,
        hasBrez=True,
        hasLust=False,
        offhealer=offhealer,
        offtank=offtank,
    )


def Evoker(name: str, offhealer=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        ranged=True,
        hasBrez=False,
        hasLust=True,
        offhealer=offhealer,
    )


def Hunter(
    name: str,
) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        ranged=True,
        hasBrez=False,
        hasLust=True,
    )


def Mage(
    name: str,
) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        ranged=True,
        hasBrez=False,
        hasLust=True,
    )


def Monk(name: str, offtank=False, offhealer=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        melee=True,
        hasBrez=False,
        hasLust=False,
        offhealer=offhealer,
        offtank=offtank,
    )


def Paladin(name: str, offtank=False, offhealer=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        melee=True,
        hasBrez=True,
        hasLust=False,
        offhealer=offhealer,
        offtank=offtank,
    )


def Priest(name: str, offhealer=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        ranged=True,
        hasBrez=False,
        hasLust=False,
        offhealer=offhealer,
    )


def Rogue(
    name: str,
) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        melee=True,
        hasBrez=False,
        hasLust=False,
    )


def Shaman(name: str, offhealer=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        ranged=True,
        hasBrez=False,
        hasLust=True,
        offhealer=offhealer,
    )


def Warlock(name: str) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        ranged=True,
        hasBrez=False,
        hasLust=False,
    )


def Warrior(name: str, offtank=False) -> WoWPlayer:
    return WoWPlayer(
        name=name,
        dpsMain=True,
        melee=True,
        hasBrez=False,
        hasLust=False,
        offtank=offtank,
    )
