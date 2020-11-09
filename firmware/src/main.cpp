
#include <Arduino.h>

#include <PololuRPiSlave.h>
#include <Romi32U4.h>
#include <ServoT3.h>

#include "shmem_buffer.h"

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

bool dio8IsInput = false;
bool isConfigured = false;
unsigned long lastHeartbeat = 0;


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

void configureIO(uint8_t config) {
  uint8_t ioChannel = (config >> 2) & 0xF;
  uint8_t mode = config & 0x3;

  if (ioChannel < 0 || ioChannel > 4) return;
  ioChannelModes[ioChannel] = mode;

  // Detach any attached servos
  if (mode != kModePwm && pwms[ioChannel].attached()) {
    pwms[ioChannel].detach();
  }

  switch(mode) {
    case kModeDigitalOut:
      pinMode(ioDioPins[ioChannel], OUTPUT);
      break;
    case kModeDigitalIn:
      pinMode(ioDioPins[ioChannel], INPUT);
      break;
    case kModePwm:
      if (!pwms[ioChannel].attached()) {
        pwms[ioChannel].attach(ioDioPins[ioChannel]);
      }
      break;
  }

  // Also set the status flag
  rPiLink.buffer.status = 1;
  isConfigured = true;

  rPiLink.buffer.ioConfig = 0;
}

void setup() {
  rPiLink.init(20);

  pwms[0].attach(21);
  pwms[1].attach(22);

  buzzer.play("v10>>g16>>>c16");
}

void loop() {
  // Get the latest data including recent i2c master writes
  rPiLink.updateBuffer();

  if (isConfigured) {
    rPiLink.buffer.status = 1;
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

  uint8_t ioConfig = rPiLink.buffer.ioConfig;
  if ((ioConfig >> 7) & 0x1) {
    configureIO(ioConfig);
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
        if (pwms[i].attached()) {
          pwms[i].write(map(rPiLink.buffer.extIoValues[i], -400, 400, 0, 180));
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

  rPiLink.buffer.batteryMillivolts = readBatteryMillivolts();

  rPiLink.finalizeWrites();
}
