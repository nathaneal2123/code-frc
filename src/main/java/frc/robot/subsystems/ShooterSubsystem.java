package frc.robot.subsystems;

import com.revrobotics.spark.SparkMax;
import com.revrobotics.spark.SparkLowLevel.MotorType;

import edu.wpi.first.math.system.plant.DCMotor;
import static edu.wpi.first.units.Units.*;
import edu.wpi.first.units.measure.AngularVelocity;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.Constants;
import yams.gearing.GearBox;
import yams.gearing.MechanismGearing;
import yams.mechanisms.config.FlyWheelConfig;
import yams.mechanisms.velocity.FlyWheel;
import yams.motorcontrollers.SmartMotorController;
import yams.motorcontrollers.SmartMotorControllerConfig;
import yams.motorcontrollers.SmartMotorControllerConfig.ControlMode;
import yams.motorcontrollers.SmartMotorControllerConfig.MotorMode;
import yams.motorcontrollers.SmartMotorControllerConfig.TelemetryVerbosity;
import yams.motorcontrollers.local.SparkWrapper;

public class ShooterSubsystem extends SubsystemBase {

    public static final double DEFAULT_SHOOT_RPM = Constants.ShooterConstants.kDefaultShootRPM;
    private static final AngularVelocity RPM_TOLERANCE = RPM.of(Constants.ShooterConstants.kRPMTolerance);

    // --- LEFT SHOOTER ---
    private final SparkMax leftMotor = new SparkMax(
        Constants.ShooterConstants.kLeftMotorId, MotorType.kBrushless);

    private final SmartMotorControllerConfig leftSMCConfig = new SmartMotorControllerConfig(this)
        .withControlMode(ControlMode.CLOSED_LOOP)
        .withClosedLoopController(
            Constants.ShooterConstants.kP,
            Constants.ShooterConstants.kI,
            Constants.ShooterConstants.kD)
        .withTelemetry("ShooterLeftMotor", TelemetryVerbosity.HIGH)
        .withGearing(new MechanismGearing(GearBox.fromReductionStages(1)))
        .withMotorInverted(false)
        .withIdleMode(MotorMode.COAST)
        .withStatorCurrentLimit(Amps.of(Constants.ShooterConstants.kStatorCurrentLimit));

    private final SmartMotorController leftSMC = new SparkWrapper(
        leftMotor, DCMotor.getNEO(1), leftSMCConfig);

    private FlyWheel leftLauncher;

    // --- RIGHT SHOOTER ---
    private final SparkMax rightMotor = new SparkMax(
        Constants.ShooterConstants.kRightMotorId, MotorType.kBrushless);

    private final SmartMotorControllerConfig rightSMCConfig = new SmartMotorControllerConfig(this)
        .withControlMode(ControlMode.CLOSED_LOOP)
        .withClosedLoopController(
            Constants.ShooterConstants.kP,
            Constants.ShooterConstants.kI,
            Constants.ShooterConstants.kD)
        .withTelemetry("ShooterRightMotor", TelemetryVerbosity.HIGH)
        .withGearing(new MechanismGearing(GearBox.fromReductionStages(1)))
        .withMotorInverted(true)
        .withIdleMode(MotorMode.COAST)
        .withStatorCurrentLimit(Amps.of(Constants.ShooterConstants.kStatorCurrentLimit));

    private final SmartMotorController rightSMC = new SparkWrapper(
        rightMotor, DCMotor.getNEO(1), rightSMCConfig);

    private FlyWheel rightLauncher;

    public ShooterSubsystem() {
        leftLauncher = new FlyWheel(
            new FlyWheelConfig(leftSMC)
                .withDiameter(Inches.of(4))
                .withMass(Pounds.of(0.5))
                .withTelemetry("LeftLauncher", TelemetryVerbosity.HIGH));

        rightLauncher = new FlyWheel(
            new FlyWheelConfig(rightSMC)
                .withDiameter(Inches.of(4))
                .withMass(Pounds.of(0.5))
                .withTelemetry("RightLauncher", TelemetryVerbosity.HIGH));
    }

    /** Returns true when both shooters are at target speed */
    public boolean atSpeed(double targetRPM) {
        return leftLauncher.isNear(RPM.of(targetRPM), RPM_TOLERANCE).getAsBoolean() &&
               rightLauncher.isNear(RPM.of(targetRPM), RPM_TOLERANCE).getAsBoolean();
    }

    /** Spin both launchers at the given RPM, stop when command ends */
    public Command shootBothCommand(double targetRPM) {
        return run(() -> {
            leftSMC.setVelocity(RPM.of(targetRPM));
            rightSMC.setVelocity(RPM.of(targetRPM));
        }).finallyDo(() -> {
            leftSMC.setDutyCycle(0);
            rightSMC.setDutyCycle(0);
        }).withName("Shooter.ShootBoth");
    }

    /** Spin up and wait until both are at speed */
    public Command spinUpAndWaitCommand(double targetRPM) {
        return Commands.parallel(
            leftLauncher.runTo(RPM.of(targetRPM), RPM_TOLERANCE).asProxy(),
            rightLauncher.runTo(RPM.of(targetRPM), RPM_TOLERANCE).asProxy()
        ).withName("Shooter.SpinUpAndWait");
    }

    /** Fire just the left launcher */
    public Command shootLeftCommand(double targetRPM) {
        return run(() -> leftSMC.setVelocity(RPM.of(targetRPM)))
            .finallyDo(() -> leftSMC.setDutyCycle(0))
            .withName("Shooter.ShootLeft");
    }

    /** Fire just the right launcher */
    public Command shootRightCommand(double targetRPM) {
        return run(() -> rightSMC.setVelocity(RPM.of(targetRPM)))
            .finallyDo(() -> rightSMC.setDutyCycle(0))
            .withName("Shooter.ShootRight");
    }

    /** Stop both shooters */
    public Command stopCommand() {
        return runOnce(() -> {
            leftSMC.setDutyCycle(0);
            rightSMC.setDutyCycle(0);
        }).withName("Shooter.Stop");
    }

    @Override
    public void periodic() {
        leftLauncher.updateTelemetry();
        rightLauncher.updateTelemetry();
    }

    @Override
    public void simulationPeriodic() {
        leftLauncher.simIterate();
        rightLauncher.simIterate();
    }
}
