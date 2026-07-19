import { useState } from 'react';
import { HUB_ENABLED_COUNTRY_LIST } from '@/components/layout/header/utils';

export const useFirebaseCountriesConfig = () => {
    const [countriesConfig, setCountriesConfig] = useState<Record<string, any>>({
        hub_enabled_country_list: HUB_ENABLED_COUNTRY_LIST(),
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    void setCountriesConfig;
    void setIsLoading;
    void setError;

    return {
        countriesConfig,
        isLoading,
        error,
        hubEnabledCountryList: countriesConfig?.hub_enabled_country_list || [],
    };
};
