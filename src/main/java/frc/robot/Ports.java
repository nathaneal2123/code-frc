package frc.robot;

import com.ctre.phoenix6.CANBus;

public final class Ports {
    // CAN Buses
    public static final CANBus kRoboRioCANBus = new CANBus("rio");

    

    // Talon FX IDs
    public static final int kIntakePivot = 40;
    public static final int kIntakeRollers = 41;

}
