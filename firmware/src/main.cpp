#include <Arduino.h>

#include <PololuRPiSlave.h>
#include <Romi32U4.h>
#include <ServoT3.h>

#include "shmem_buffer.h"
#include "low_voltage_helper.h"

static constexpr int kModeDigitalOut = 0;
static constexpr int kModeDigitalIn = 1;
static constexpr int kModeAnalogIn = 2;
static constexpr int kModePwm = 3;

/*

  // Built-ins
  bool buttonA;         // DIO 0 (input only)
  bool buttonB, green;  // DIO 1
  bool buttonC, red;    // DIO 2
  bool yellow;          // DIO 3 (output only)
  */


static constexpr int kMaxBuiltInDIO = 8;

// Set up the servos
Servo pwms[5];

Romi32U4Motors motors;
Romi32U4Encoders encoders;
Romi32U4ButtonA buttonA;
Romi32U4ButtonB buttonB;
Romi32U4ButtonC buttonC;
Romi32U4Buzzer buzzer;

PololuRPiSlave<Data, 20> rPiLink;

uint8_t builtinDio0Config = kModeDigitalIn;
uint8_t builtinDio1Config = kModeDigitalOut;
uint8_t builtinDio2Config = kModeDigitalOut;
uint8_t builtinDio3Config = kModeDigitalOut;

uint8_t ioChannelModes[5] = {kModeDigitalOut, kModeDigitalOut, kModeDigitalOut, kModeDigitalOut, kModeDigitalOut};
uint8_t ioDioPins[5] = {11, 4, 20, 21, 22};
uint8_t ioAinPins[5] = {0, A6, A2, A3, A4};

LowVoltageHelper lvHelper;

bool isTestMode = false;
bool isConfigured = false;

unsigned long lastHeartbeat = 0;

bool testModeLedFlag = false;
unsigned long lastSwitchTime = 0;

void configureBuiltins(uint8_t config) {
  // structure
  // [ConfigFlag] [Unused] [Unused] [Unused] [Unused] [DIO 2 Mode] [DIO 1 Mode] [Unused]
  //       7         6        5         4        3          2            1          0

  // We only care about bits 1 and 2
  builtinDio1Config = (config >> 1) & 0x1;
  builtinDio2Config = (config >> 2) & 0x1;

  // Turn off LEDs if in INPUT mode
  if (builtinDio1Config == kModeDigitalIn) {
    ledGreen(false);
  }
  if (builtinDio2Config == kModeDigitalIn) {
    ledRed(false);
  }

  // Wipe out the register
  rPiLink.buffer.builtinConfig = 0;
}

void configureIO(uint16_t config) {
  // 16 bit config register
  //
  // MSB
  // 0 | NEW CONFIG FLAG |
  //   |-----------------|
  // 1 |  Pin 0 Mode     |
  // 2 |  ArdPin 11      |
  //   |-----------------|
  // 3 |  Pin 1 Mode     |
  // 4 |  ArdPin 4       |
  //   |-----------------|
  // 5 |  Pin 2 Mode     |
  // 6 |  ArdPin 20      |
  //   |-----------------|
  // 7 |  Pin 3 Mode     |
  // 8 |  ArdPin 21      |
  //   |-----------------|
  // 9 |  Pin 4 Mode     |
  // 10|  ArdPin 22      |
  //   |-----------------|
  // 11|  RESERVED       |
  // 12|                 |
  // 13|                 |
  // 14|                 |
  // 15|                 |
  for (uint8_t ioChannel = 0; ioChannel < 5; ioChannel++) {
    uint8_t offset = 13 - (2 * ioChannel);
    uint8_t mode = (config >> offset) & 0x3;

    // Disconnect PWMs
    if (pwms[ioChannel].attached()) {
      pwms[ioChannel].detach();
    }

    ioChannelModes[ioChannel] = mode;

    switch(mode) {
      case kModeDigitalOut:
        pinMode(ioDioPins[ioChannel], OUTPUT);
        break;
      case kModeDigitalIn:
        pinMode(ioDioPins[ioChannel], INPUT_PULLUP);
        break;
      case kModePwm:
        pwms[ioChannel].attach(ioDioPins[ioChannel]);
        break;
      case kModeAnalogIn:
        if (ioChannel > 0) {
          // Make sure we set the pin back correctly
          digitalWrite(ioAinPins[ioChannel], LOW);
          pinMode(ioAinPins[ioChannel], INPUT);
        }
        break;
    }
  }

  // Also set the status flag
  rPiLink.buffer.status = 1;
  isConfigured = true;

  // Reset the config register
  rPiLink.buffer.ioConfig = 0;
}

// Initialization routines for test mode
void testModeInit() {
  buzzer.play("!L16 v10 cdefgab>c");

  while(buzzer.playCheck()) {
    // no-op to let the init sound finish
  }

  Serial.begin(9600);
}

// Initialization routines for normal operation
void normalModeInit() {
  buzzer.play("v10>>g16>>>c16");
  while(buzzer.playCheck()) {
    // no-op to let the init sound finish
  }
  // Default state in wpilib is true. For green
  // and red, they will be specified to output
  // during run-time. Turning off by default
  ledYellow(true);
  ledGreen(false);
  ledRed(false);
}

void testModeConfigureIO(uint16_t config) {
  for (uint8_t ioChannel = 0; ioChannel < 5; ioChannel++) {
    uint8_t offset = 13 - (2 * ioChannel);
    uint8_t mode = (config >> offset) & 0x3;

    Serial.print(ioChannel);
    Serial.print(": ");
    switch(mode) {
      case kModeDigitalOut:
        Serial.print("DOUT");
        break;
      case kModeDigitalIn:
        Serial.print("DIN");
        break;
      case kModePwm:
        Serial.print("PWM");
        break;
      case kModeAnalogIn:
        Serial.print("AIN");
        break;
    }

    if (ioChannel < 4) {
      Serial.print(", ");
    }
  }
  Serial.println("");

  // Also set the status flag
  rPiLink.buffer.status = 1;
  isConfigured = true;

  // Reset the config register
  rPiLink.buffer.ioConfig = 0;
}

void testModeLoop() {
  // Used to verify mode settings
  uint16_t ioConfig = rPiLink.buffer.ioConfig;
  if ((ioConfig >> 15) & 0x1) {
    Serial.println("Requested to configure IO pins");
    testModeConfigureIO(ioConfig);
  }

  // Flash the LEDs
  if (millis() - lastSwitchTime > 500) {
    lastSwitchTime = millis();
    testModeLedFlag = !testModeLedFlag;

    ledGreen(testModeLedFlag);
    ledRed(!testModeLedFlag);
  }
}

void normalModeLoop() {
  uint16_t battMV = readBatteryMillivolts();
  lvHelper.update(battMV);

  // Play the LV alert tune if we're in a low voltage state
  lvHelper.lowVoltageAlertCheck();

  // Shutdown motors if in low voltage mode
  if (lvHelper.isLowVoltage()) {
    rPiLink.buffer.leftMotor = 0;
    rPiLink.buffer.rightMotor = 0;
  }

  // Check heartbeat and shutdown motors if necessary
  if (millis() - lastHeartbeat > 1000) {
    rPiLink.buffer.leftMotor = 0;
    rPiLink.buffer.rightMotor = 0;
  }

  if (rPiLink.buffer.heartbeat) {
    lastHeartbeat = millis();
    rPiLink.buffer.heartbeat = false;
  }

  uint8_t builtinConfig = rPiLink.buffer.builtinConfig;
  if ((builtinConfig >> 7) & 0x1) {
    configureBuiltins(builtinConfig);
  }

  uint16_t ioConfig = rPiLink.buffer.ioConfig;
  if ((ioConfig >> 15) & 0x1) {
    configureIO(ioConfig);
  }

  // Update the built-ins
  rPiLink.buffer.builtinDioValues[0] = buttonA.isPressed();
  ledYellow(rPiLink.buffer.builtinDioValues[3]);

  if (builtinDio1Config == kModeDigitalIn) {
    rPiLink.buffer.builtinDioValues[1] = buttonB.isPressed();
  }
  else {
    ledGreen(rPiLink.buffer.builtinDioValues[1]);
  }

  if (builtinDio2Config == kModeDigitalIn) {
    rPiLink.buffer.builtinDioValues[2] = buttonC.isPressed();
  }
  else {
    ledRed(rPiLink.buffer.builtinDioValues[2]);
  }

  // Loop through all available IO pins
  for (uint8_t i = 0; i < 5; i++) {
    switch (ioChannelModes[i]) {
      case kModeDigitalOut: {
        digitalWrite(ioDioPins[i], rPiLink.buffer.extIoValues[i] ? HIGH : LOW);
      } break;
      case kModeDigitalIn: {
        rPiLink.buffer.extIoValues[i] = digitalRead(ioDioPins[i]);
      } break;
      case kModeAnalogIn: {
        if (ioAinPins[i] != 0) {
          rPiLink.buffer.extIoValues[i] = analogRead(ioAinPins[i]);
        }
      } break;
      case kModePwm: {
        // Only allow writes to PWM if we're not currently locked out due to low voltage
        if (pwms[i].attached()) {
          if (!lvHelper.isLowVoltage()) {
            pwms[i].write(map(rPiLink.buffer.extIoValues[i], -400, 400, 0, 180));
          }
          else {
            // Attempt to zero out servo-motors in a low voltage mode
            pwms[i].write(90);
          }
        }
      } break;
    }
  }

  // Motors
  motors.setSpeeds(rPiLink.buffer.leftMotor, rPiLink.buffer.rightMotor);

  // Encoders
  if (rPiLink.buffer.resetLeftEncoder) {
    rPiLink.buffer.resetLeftEncoder = false;
    encoders.getCountsAndResetLeft();
  }

  if (rPiLink.buffer.resetRightEncoder) {
    rPiLink.buffer.resetRightEncoder = false;
    encoders.getCountsAndResetRight();
  }

  rPiLink.buffer.leftEncoder = encoders.getCountsLeft();
  rPiLink.buffer.rightEncoder = encoders.getCountsRight();

  rPiLink.buffer.batteryMillivolts = battMV;
}

void setup() {
  rPiLink.init(20);

  // Set up the buzzer in playcheck mode
  buzzer.playMode(PLAY_CHECK);

  // Flip the right side motor to better match normal FRC setups
  motors.flipRightMotor(true);

  // Determine if we should enter test mode
  // If button A and B are pressed during power up, enter test mode
  if (buttonA.isPressed() && buttonB.isPressed()) {
    isTestMode = true;
  }

  if (isTestMode) {
    testModeInit();
  }
  else {
    normalModeInit();
  }
}

void loop() {
  // Get the latest data including recent i2c master writes
  rPiLink.updateBuffer();

  // Constantly write the firmware ident
  rPiLink.buffer.firmwareIdent = FIRMWARE_IDENT;

  if (isConfigured) {
    rPiLink.buffer.status = 1;
  }

  if (isTestMode) {
    testModeLoop();
  }
  else {
    normalModeLoop();
  }

  rPiLink.finalizeWrites();
}
