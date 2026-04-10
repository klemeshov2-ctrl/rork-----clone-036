import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import createContextHook from '@nkzw/create-context-hook';

const ACCESS_VALIDATED_KEY = '@access_code_validated';
const VALID_CODE_HASH = '168f1447d3ca61b84eedd6612caef3ee9b60b480c4e7b7814a6fa2beb1b706cc';

interface AccessCodeContextType {
  isAccessGranted: boolean;
  isAccessLoading: boolean;
  validateCode: (input: string) => Promise<boolean>;
  revokeAccess: () => Promise<void>;
}

export const [AccessCodeProvider, useAccessCode] = createContextHook<AccessCodeContextType>(() => {
  const [isAccessGranted, setIsAccessGranted] = useState(false);
  const [isAccessLoading, setIsAccessLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ACCESS_VALIDATED_KEY)
      .then((val) => {
        if (val === 'true') {
          setIsAccessGranted(true);
          console.log('[AccessCode] Access previously granted');
        } else {
          console.log('[AccessCode] No saved access, code required');
        }
      })
      .catch(() => {
        console.log('[AccessCode] Error reading access state');
      })
      .finally(() => {
        setIsAccessLoading(false);
      });
  }, []);

  const validateCode = useCallback(async (input: string): Promise<boolean> => {
    try {
      const normalized = input.trim().toUpperCase();
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        normalized
      );
      console.log('[AccessCode] Validating code, hash match:', hash === VALID_CODE_HASH);
      if (hash === VALID_CODE_HASH) {
        setIsAccessGranted(true);
        await AsyncStorage.setItem(ACCESS_VALIDATED_KEY, 'true');
        return true;
      }
      return false;
    } catch (err) {
      console.log('[AccessCode] Validation error:', err);
      return false;
    }
  }, []);

  const revokeAccess = useCallback(async () => {
    try {
      setIsAccessGranted(false);
      await AsyncStorage.removeItem(ACCESS_VALIDATED_KEY);
      console.log('[AccessCode] Access revoked');
    } catch (err) {
      console.log('[AccessCode] Revoke error:', err);
    }
  }, []);

  return useMemo(() => ({
    isAccessGranted,
    isAccessLoading,
    validateCode,
    revokeAccess,
  }), [isAccessGranted, isAccessLoading, validateCode, revokeAccess]);
});
