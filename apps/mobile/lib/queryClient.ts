import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';


// Create a single QueryClient instance to be used throughout the app
// QueryClient is the core cache manager 
// Any screen that uses useQuery shares this single instance
// fetched data is available globally and not re-fetched per component
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 60 * 24, // 1 day
            retry: 2, // Retry failed queries twice
        },
    },
});


// The persister is the bridge between React Query's in-memory cache and AsyncStorage
// without this, cached data is lost every time th app is closed
// with it, the entire query cahce is serialized to AsyncStorage and rehydrated on app launch
// so drivers can open that app with no connection and still see their last loaded jobs
export const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: "EATON_QUEARY_CACHE",
    throttleTime: 1000, // Throttle saves to at most once per second
});