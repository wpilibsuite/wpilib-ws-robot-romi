#pragma once

#include <inttypes.h>

static constexpr uint16_t kMinOperatingMV = 5550;
static constexpr uint16_t kLVCountThreshold = 500; // 500 cycles

class LowVoltageHelper {
  public:
    static void update(uint16_t currVoltageMV);
    static bool isLowVoltage();
    static void lowVoltageAlertCheck();
};
