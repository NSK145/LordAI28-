package com.nagasatwik145.lordai;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.ByteBuffer;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureSessionStorage")
public class SecureSessionStoragePlugin extends Plugin {
    private static final String PREFS_NAME = "lord_secure_auth_v1";
    private static final String KEY_ALIAS = "lord_secure_auth_aes_v1";
    private static final int GCM_TAG_BITS = 128;

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("A storage key is required.");
            return;
        }
        try {
            String encrypted = preferences().getString(key, null);
            if (encrypted == null) {
                call.resolve(new JSObject());
                return;
            }
            byte[] payload = Base64.decode(encrypted, Base64.NO_WRAP);
            ByteBuffer buffer = ByteBuffer.wrap(payload);
            int ivLength = buffer.getInt();
            if (ivLength <= 0 || ivLength > 32 || ivLength > buffer.remaining()) {
                throw new IllegalStateException("Invalid encrypted session data.");
            }
            byte[] iv = new byte[ivLength];
            buffer.get(iv);
            byte[] ciphertext = new byte[buffer.remaining()];
            buffer.get(ciphertext);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getSecretKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            String value = new String(cipher.doFinal(ciphertext), java.nio.charset.StandardCharsets.UTF_8);
            JSObject result = new JSObject();
            result.put("value", value);
            call.resolve(result);
        } catch (Exception error) {
            // Corrupt or invalidated data must log out safely instead of falling
            // back to the old plaintext token.
            try {
                preferences().edit().remove(key).commit();
            } catch (Exception ignored) {
                // Resolve empty so the auth client starts signed out.
            }
            call.resolve(new JSObject());
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || key.isEmpty() || value == null) {
            call.reject("A storage key and value are required.");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getSecretKey());
            byte[] iv = cipher.getIV();
            byte[] ciphertext = cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            ByteBuffer payload = ByteBuffer.allocate(4 + iv.length + ciphertext.length);
            payload.putInt(iv.length).put(iv).put(ciphertext);
            String encrypted = Base64.encodeToString(payload.array(), Base64.NO_WRAP);
            if (!preferences().edit().putString(key, encrypted).commit()) {
                throw new IllegalStateException("Encrypted session could not be saved.");
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not securely save the sign-in session.");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("A storage key is required.");
            return;
        }
        if (!preferences().edit().remove(key).commit()) {
            call.reject("Could not remove the saved sign-in session.");
            return;
        }
        call.resolve();
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
    }

    private SecretKey getSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        java.security.Key existing = keyStore.getKey(KEY_ALIAS, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }
}
