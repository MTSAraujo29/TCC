import React from 'react';

function DeviceList({ devices, toggleDeviceStatus }) {
    return ( <
        section aria - label = "Lista de dispositivos" >
        <
        h2 > Dispositivos < /h2> <
        ul > {
            devices.map(device => ( <
                li key = { device.id } >
                <
                span > { device.name } < /span> <
                button onClick = {
                    () => toggleDeviceStatus(device.id)
                } > { device.powerState ? 'Desligar' : 'Ligar' } <
                /button> < /
                li >
            ))
        } <
        /ul> < /
        section >
    );
}

export default React.memo(DeviceList);