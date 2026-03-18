package frc.robot.subsystems;

import com.revrobotics.spark.SparkMax;
import com.revrobotics.spark.SparkLowLevel.MotorType;
import com.ctre.phoenix6.hardware.TalonFX;

import edu.wpi.first.math.system.plant.DCMotor;
import static edu.wpi.first.units.Units.*;
import edu.wpi.first.units.measure.Angle;
import edu.wpi.first.wpilibj.smartdashboard.Mechanism2d;
import edu.wpi.first.wpilibj.smartdashboard.MechanismLigament2d;
import edu.wpi.first.wpilibj.smartdashboard.MechanismRoot2d;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj.util.Color;
import edu.wpi.first.wpilibj.util.Color8Bit;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import frc.robot.Ports;
import yams.gearing.GearBox;
import yams.gearing.MechanismGearing;
import yams.mechanisms.config.ArmConfig;
import yams.mechanisms.positional.Arm; // Kept for the pivot
import yams.motorcontrollers.SmartMotorController;
import yams.motorcontrollers.SmartMotorControllerConfig;
import yams.motorcontrollers.SmartMotorControllerConfig.ControlMode;
import yams.motorcontrollers.SmartMotorControllerConfig.MotorMode;
import yams.motorcontrollers.SmartMotorControllerConfig.TelemetryVerbosity;
import yams.motorcontrollers.remote.TalonFXWrapper;
import yams.motorcontrollers.local.SparkWrapper;

public class IntakeSubsystem extends SubsystemBase {

  private static final double INTAKE_SPEED = 0.8;

  // --- ROLLER: Kraken X60 (TalonFX) with direct motor-to-pulley control ---
  private TalonFX rollerKraken = new TalonFX(Ports.kIntakeRollers, Ports.kRoboRioCANBus);

  private SmartMotorControllerConfig rollerConfig = new SmartMotorControllerConfig(this)
      .withControlMode(ControlMode.OPEN_LOOP)
      .withTelemetry("IntakeRollerMotor", TelemetryVerbosity.HIGH)
      .withGearing(new MechanismGearing(GearBox.fromReductionStages(1)))
      .withMotorInverted(true)
      .withIdleMode(MotorMode.COAST)
      .withStatorCurrentLimit(Amps.of(40));

  // The FlyWheel abstraction is removed; we now use the SmartMotorController directly
  private SmartMotorController rollerSMC = new TalonFXWrapper(rollerKraken, DCMotor.getKrakenX60(1), rollerConfig);

  // --- PIVOT: Updated for NEO V1.1 and 250:1 Gearing ---
  private SmartMotorControllerConfig intakePivotSmartMotorConfig = new SmartMotorControllerConfig(this)
      .withControlMode(ControlMode.CLOSED_LOOP)
      .withClosedLoopController(25, 0, 0, DegreesPerSecond.of(360), DegreesPerSecondPerSecond.of(360))
      .withTelemetry("IntakePivotMotor", TelemetryVerbosity.HIGH)
      // Gearing: 100:1 Gearbox * (30/12) Sprocket Ratio = 250:1
      .withGearing(new MechanismGearing(GearBox.fromReductionStages(100, 30.0 / 12.0)))
      .withMotorInverted(false)
      .withIdleMode(MotorMode.BRAKE)
      .withSoftLimit(Degrees.of(0), Degrees.of(150))
      .withStatorCurrentLimit(Amps.of(20))
      .withClosedLoopRampRate(Seconds.of(0.1))
      .withOpenLoopRampRate(Seconds.of(0.1));

  private SparkMax pivotMotor = new SparkMax(Ports.kIntakePivot, MotorType.kBrushless);

  // Pivot motor model changed from Neo Vortex to NEO Brushless V1.1
  private SmartMotorController intakePivotController = new SparkWrapper(pivotMotor, DCMotor.getNEO(1),
      intakePivotSmartMotorConfig);

  private final ArmConfig intakePivotConfig = new ArmConfig(intakePivotController)
      .withSoftLimits(Degrees.of(0), Degrees.of(150))
      .withHardLimit(Degrees.of(0), Degrees.of(155))
      .withStartingPosition(Degrees.of(0))
      .withLength(Feet.of(1))
      .withMass(Pounds.of(2))
      .withTelemetry("IntakePivot", TelemetryVerbosity.HIGH);

  private Arm intakePivot = new Arm(intakePivotConfig);

  // --- Mechanism2d for visualization ---
  private final Mechanism2d intakeMech = new Mechanism2d(3, 3);
  private final MechanismRoot2d intakeRoot = intakeMech.getRoot("IntakeRoot", 1.5, 0.5);
  private final MechanismLigament2d intakeArm = intakeRoot.append(
      new MechanismLigament2d("IntakeArm", 1, 0, 6, new Color8Bit(Color.kOrange))
  );

  public IntakeSubsystem() {
    SmartDashboard.putData("Intake", intakeMech);
  }

  /** Commands now control the roller motor controller directly */
  public Command intakeCommand() {
    return runEnd(() -> rollerSMC.setDutyCycle(INTAKE_SPEED), () -> rollerSMC.setDutyCycle(0))
        .withName("Intake.Run");
  }

  public Command ejectCommand() {
    return runEnd(() -> rollerSMC.setDutyCycle(-INTAKE_SPEED), () -> rollerSMC.setDutyCycle(0))
        .withName("Intake.Eject");
  }

  public Command setPivotAngle(Angle angle) {
    return intakePivot.setAngle(angle).withName("IntakePivot.SetAngle");
  }

  public Command rezero() {
    return Commands.runOnce(() -> pivotMotor.getEncoder().setPosition(0), this).withName("IntakePivot.Rezero");
  }

  public Command stowCommand() {
    return setPivotAngle(Degrees.of(0)).withName("Intake.Stow");
  }

  public Command deployAndRollCommand() {
    return Commands.sequence(
        setPivotAngle(Degrees.of(148)),
        Commands.run(() -> rollerSMC.setDutyCycle(INTAKE_SPEED), this)
            .finallyDo(() -> {
                rollerSMC.setDutyCycle(0);
                setPivotAngle(Degrees.of(115)).schedule();
            })
    ).withName("Intake.DeployAndRoll");
  }

  @Override
  public void periodic() {
    intakePivot.updateTelemetry();
    intakeArm.setAngle(intakePivotController.getMechanismPosition().in(Degrees));
    SmartDashboard.putNumber("Intake Roller DutyCycle", rollerKraken.getDutyCycle().getValueAsDouble());
  }

  @Override
  public void simulationPeriodic() {
    intakePivot.simIterate();
  }
} 