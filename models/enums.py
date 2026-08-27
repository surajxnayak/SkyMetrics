from enum import Enum


class AirportCode(str, Enum):
    DEL = "DEL"
    BOM = "BOM"
    BLR = "BLR"


class FareClass(str, Enum):
    U1 = "U1"
    T3 = "T3"
    R3 = "R3"
    R4 = "R4"
    T0 = "T0"
    Q2 = "Q2"



class Frequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class SourceName(str, Enum):
    AKASA_AIR = "akasaair"


class CarrierCode(str, Enum):
    AKASA_AIR = "QP"
