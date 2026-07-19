import { useState } from 'react';
import initData from './remote_config.json';

function useRemoteConfig(enabled = false) {
    const [data, setData] = useState(initData);
    void enabled;
    void setData;

    return { data };
}

export default useRemoteConfig;
