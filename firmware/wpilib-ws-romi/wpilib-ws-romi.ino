#include <PololuRPiSlave.h>
#include <Romi32U4.h>
#include <ServoT3.h>

#include "shmem_buffer.h";

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
Servo pwms[2];

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

bool dio8IsInput = false;

void setup() {
  rPiLink.init(20);

  pwms[0].attach(21);
  pwms[1].attach(22);

  buzzer.play("v10>>g16>>>c16");
}

unsigned long lastHeartbeat = 0;

void loop() {
  // Get the latest data including recent i2c master writes
  rPiLink.updateBuffer();

  // Check heartbeat
  if (millis() - lastHeartbeat > 1000) {
    rPiLink.buffer.pwm[0] = 0;
    rPiLink.buffer.pwm[1] = 0;
  }

  if (rPiLink.buffer.heartbeat) {
    lastHeartbeat = millis();
    rPiLink.buffer.heartbeat = false;
  }

  uint8_t builtinConfig = rPiLink.buffer.builtinConfig;
  if ((builtinConfig >> 7) & 0x1) {
    configureBuiltins(builtinConfig);
  }

  if (rPiLink.buffer.dio8Input != dio8IsInput) {
    dio8IsInput = rPiLink.buffer.dio8Input;
    if (dio8IsInput) {
      pinMode(11, INPUT);
    }
    else {
      pinMode(11, OUTPUT);
    }
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

  if (dio8IsInput) {
    rPiLink.buffer.dio8Value = digitalRead(11);
  }
  else {
    digitalWrite(11, rPiLink.buffer.dio8Value ? HIGH : LOW);
  }

  // Analog
  rPiLink.buffer.analog[0] = analogRead(A6);
  rPiLink.buffer.analog[1] = analogRead(A2);

  // Motors
  motors.setSpeeds(rPiLink.buffer.pwm[0], rPiLink.buffer.pwm[1]);

  // PWMs
  pwms[0].write(map(rPiLink.buffer.pwm[2], -400, 400, 0, 180));
  pwms[1].write(map(rPiLink.buffer.pwm[3], -400, 400, 0, 180));

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

  rPiLink.buffer.batteryMillivolts = readBatteryMillivolts();

  rPiLink.finalizeWrites();
}

void configureBuiltins(uint8_t config) {
  // structure
  // [ConfigFlag] [Unused] [Unused] [Unused] [Channel] [Mode]
  //       7         6        5         4        3,2     1,0
  uint8_t channel = (config >> 2) & 0x3;
  uint8_t mode = config & 0x3;

  // Bail early if we get an invalid DIO channel or mode
  // Also, only DIO 1 and 2 can be configured
  // TODO: set an error flag somewhere?
  if (channel > 3 || channel == 0 || channel == 3) return;
  if (mode > 1) return;

  if (channel == 1) {
    builtinDio1Config = mode;
  }
  else if (channel == 2) {
    builtinDio2Config = mode;
  }

  // Wipe out the register
  rPiLink.buffer.builtinConfig = 0;
}
