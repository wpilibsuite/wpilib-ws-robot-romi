/*----------------------------------------------------------------------------*/
/* Copyright (c) 2019 FIRST. All Rights Reserved.                             */
/* Open Source Software - may be modified and shared by FRC teams. The code   */
/* must be accompanied by the FIRST BSD license file in the root directory of */
/* the project.                                                               */
/*----------------------------------------------------------------------------*/

package frc.robot.subsystems;

import edu.wpi.first.wpilibj.Servo;
import edu.wpi.first.wpilibj2.command.SubsystemBase;

public class ClawArm extends SubsystemBase {
  // The Claw Arm consists of 3 servos. Two to control the
  // height/pitch of the arm, and one to control the claw
  private Servo m_heightServo = new Servo(3);
  private Servo m_pitchServo = new Servo(2);
  private Servo m_clawServo = new Servo(4);

  private static final double kHeightMinAngle = 0;
  private static final double kHeightMaxAngle = 0;

  public static enum ArmFixedHeight {
    LOW,
    MID,
    HIGH
  }

  /**
   * Creates a new ClawArm.
   */
  public ClawArm() {


  }

  private long m_lastUpdateTime = 0;
  private double m_heightAngle = 0;
  private double m_heightAngleDelta = 1.0;

  @Override
  public void periodic() {
    // This method will be called once per scheduler run
    if (System.currentTimeMillis() - m_lastUpdateTime > 200) {
      m_lastUpdateTime = System.currentTimeMillis();
      m_heightServo.setAngle(m_heightAngle);

      m_heightAngle += m_heightAngleDelta;
      if (m_heightAngle > 180 ) {
        m_heightAngle = 180;
        m_heightAngleDelta = -m_heightAngleDelta;
      }
      else if (m_heightAngle < 0) {
        m_heightAngle = 0;
        m_heightAngleDelta = -m_heightAngleDelta;
      }
    }
  }
}
