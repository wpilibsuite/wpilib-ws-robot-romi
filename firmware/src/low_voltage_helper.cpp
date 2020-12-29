#include "low_voltage_helper.h"
#include <Romi32U4Buzzer.h>

static volatile unsigned long stateCount = 0;

static const char lvTune[] PROGMEM = "!L8 V8 A<A A<A A<A A<A R1R1";

enum LVMonitorState { NORMAL, NORMAL_TO_LV, LOW_VOLTAGE, LV_TO_NORMAL };
static LVMonitorState state = NORMAL;

static Romi32U4Buzzer bzr;

void LowVoltageHelper::update(uint16_t currVoltageMV) {
  bool isLV = currVoltageMV < kMinOperatingMV;

  switch (state) {
    case NORMAL:
      if (isLV) {
        stateCount = 0;
        state = NORMAL_TO_LV;
      }
      break;
    case NORMAL_TO_LV:
      if (isLV) {
        stateCount++;
        if (stateCount >= kLVCountThreshold) {
          stateCount = 0;
          state = LOW_VOLTAGE;
        }
      }
      else {
        stateCount = 0;
        state = NORMAL;
      }
      break;
    case LOW_VOLTAGE:
      if (!isLV) {
        stateCount = 0;
        state = LV_TO_NORMAL;
      }
      break;
    case LV_TO_NORMAL:
      if (!isLV) {
        stateCount++;
        if (stateCount >= kLVCountThreshold) {
          stateCount = 0;
          state = NORMAL;
        }
      }
      else {
        stateCount = 0;
        state = LOW_VOLTAGE;
      }
      break;
  }
}

bool LowVoltageHelper::isLowVoltage() {
  return (state == LOW_VOLTAGE || state == LV_TO_NORMAL);
}

void LowVoltageHelper::lowVoltageAlertCheck() {
  if (isLowVoltage()) {
    if (!bzr.playCheck()) {
      bzr.playFromProgramSpace(lvTune);
    }
  }
  else {
    bzr.stopPlaying();
  }
}
