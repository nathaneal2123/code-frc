// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot;

import static edu.wpi.first.units.Units.RPM;
import static edu.wpi.first.units.Units.RotationsPerSecond;

import edu.wpi.first.units.measure.AngularVelocity;
import edu.wpi.first.units.measure.LinearVelocity;
import frc.robot.generated.TunerConstants;

/**
 * The Constants class provides a convenient place for teams to hold robot-wide numerical or boolean
 * constants. This class should not be used for any other purpose. All constants should be declared
 * globally (i.e. public static). Do not put anything functional in this class.
 *
 * <p>It is advised to statically import this class (or one of its inner classes) wherever the
 * constants are needed, to reduce verbosity.
 */
public final class Constants {
    public static class Driving {
        public static final LinearVelocity kMaxSpeed = TunerConstants.kSpeedAt12Volts;
        public static final AngularVelocity kMaxRotationalRate = RotationsPerSecond.of(1);
        public static final AngularVelocity kPIDRotationDeadband = kMaxRotationalRate.times(0.005);
    }

    public static class KrakenX60 {
        public static final AngularVelocity kFreeSpeed = RPM.of(6000);
    }
    // Hopper subsystem CAN IDs start at 40
    public static class HopperConstants {
    public static final int kHopperMotorId = 34; // <-- change to your actual CAN ID
    }
    public static class FeederConstants {
    public static final int kFeederMotorId = 30; // <-- change to your actual CAN ID
    }
    public static class ShooterConstants {
        public static final int kLeftMotorId  = 32; // change to actual CAN ID
        public static final int kRightMotorId = 31; // change to actual CAN ID

        // Tuning — adjust these on the actual robot
        public static final double kDefaultShootRPM = 3000;
        public static final double kRPMTolerance     = 100;
        public static final double kP                = 0.0006;
        public static final double kI                = 0;
        public static final double kD                = 0;
        public static final double kStatorCurrentLimit = 40;
    }
}