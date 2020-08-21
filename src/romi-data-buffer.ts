enum BaseDataType {
    BOOL,
    UINT8_T,
    INT8_T,
    UINT16_T,
    INT16_T
};

function getDataTypeSize(type: BaseDataType): number {
    switch (type) {
        case BaseDataType.BOOL:
        case BaseDataType.UINT8_T:
        case BaseDataType.INT8_T:
            return 1;
        case BaseDataType.UINT16_T:
        case BaseDataType.INT16_T:
            return 2;
    }
}

interface IDataFieldInfo {
    type: BaseDataType;
    arraySize?: number;
}

interface IDataField {
    name: string;
    fieldInfo: IDataFieldInfo
};

interface ISharedMemDataFieldPositional extends IDataFieldInfo {
    offset: number;
};

interface SharedMemDataBuffer { [key: string]: ISharedMemDataFieldPositional };

// NOTE This MUST match the firmware!
const i2cBufferLayout: IDataField[] = [
    { name: "synced", fieldInfo: { type: BaseDataType.BOOL }},
    { name: "heartbeat", fieldInfo: { type: BaseDataType.BOOL }},

    { name: "builtinConfig", fieldInfo: { type: BaseDataType.UINT8_T }},
    { name: "builtinDioValues", fieldInfo: { type: BaseDataType.BOOL, arraySize: 4 }},

    { name: "dio8Input", fieldInfo: { type: BaseDataType.BOOL }},
    { name: "dio8Value", fieldInfo: { type: BaseDataType.BOOL }},

    { name: "analog", fieldInfo: { type: BaseDataType.UINT16_T, arraySize: 2 }},

    { name: "pwm", fieldInfo: { type: BaseDataType.INT16_T, arraySize: 4 }},

    { name: "batteryMillivolts", fieldInfo: { type: BaseDataType.UINT16_T }},

    { name: "resetLeftEncoder", fieldInfo: { type: BaseDataType.BOOL }},
    { name: "resetRightEncoder", fieldInfo: { type: BaseDataType.BOOL }},
    { name: "leftEncoder", fieldInfo: { type: BaseDataType.INT16_T }},
    { name: "rightEncoder", fieldInfo: { type: BaseDataType.INT16_T }},
];

function generateDataBufferInfo(fields: IDataField[]): SharedMemDataBuffer {
    const dataBuffer: SharedMemDataBuffer = {};
    let currOffset = 0;

    fields.forEach(field => {
        const fieldInfo = field.fieldInfo;
        const dataBufferField: ISharedMemDataFieldPositional = {
            offset: currOffset,
            ...fieldInfo
        };

        let dataSize = getDataTypeSize(fieldInfo.type);

        if (fieldInfo.arraySize !== undefined) {
            dataSize *= fieldInfo.arraySize;
        }

        currOffset += dataSize;

        dataBuffer[field.name] = dataBufferField;
    });

    return dataBuffer;
}

const RomiDataBuffer: SharedMemDataBuffer = Object.freeze(generateDataBufferInfo(i2cBufferLayout));

export default RomiDataBuffer;
