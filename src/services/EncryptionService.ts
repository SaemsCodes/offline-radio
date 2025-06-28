
export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedMessage {
  data: ArrayBuffer;
  iv: ArrayBuffer;
  tag?: ArrayBuffer;
  senderPublicKey: ArrayBuffer;
}

export interface DevicePairing {
  deviceId: string;
  publicKey: ArrayBuffer;
  sharedSecret: ArrayBuffer;
  verified: boolean;
  timestamp: number;
}

export class EncryptionService {
  private keyPair: KeyPair | null = null;
  private pairedDevices: Map<string, DevicePairing> = new Map();
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  async initialize(): Promise<void> {
    try {
      // Generate ECDH key pair for device
      this.keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false, // Not extractable for security
        ['deriveKey', 'deriveBits']
      );

      console.log('Encryption service initialized with ECDH key pair');
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      throw error;
    }
  }

  async getPublicKeyBytes(): Promise<ArrayBuffer> {
    if (!this.keyPair) {
      throw new Error('Encryption service not initialized');
    }

    return await window.crypto.subtle.exportKey('raw', this.keyPair.publicKey);
  }

  async generatePairingCode(): Promise<string> {
    const publicKeyBytes = await this.getPublicKeyBytes();
    const pairingData = {
      deviceId: this.deviceId,
      publicKey: Array.from(new Uint8Array(publicKeyBytes)),
      timestamp: Date.now()
    };

    // Generate base64 encoded pairing code
    const jsonString = JSON.stringify(pairingData);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    
    // Convert to base64
    let binary = '';
    const bytes = new Uint8Array(data);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  }

  async processPairingCode(pairingCode: string): Promise<DevicePairing> {
    try {
      // Decode base64 pairing code
      const binary = atob(pairingCode);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(bytes);
      const pairingData = JSON.parse(jsonString);

      // Import the other device's public key
      const otherPublicKeyBytes = new Uint8Array(pairingData.publicKey).buffer;
      const otherPublicKey = await window.crypto.subtle.importKey(
        'raw',
        otherPublicKeyBytes,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false,
        []
      );

      // Derive shared secret
      const sharedSecret = await this.deriveSharedSecret(otherPublicKey);

      const pairing: DevicePairing = {
        deviceId: pairingData.deviceId,
        publicKey: otherPublicKeyBytes,
        sharedSecret,
        verified: false,
        timestamp: pairingData.timestamp
      };

      this.pairedDevices.set(pairingData.deviceId, pairing);
      return pairing;
    } catch (error) {
      console.error('Failed to process pairing code:', error);
      throw new Error('Invalid pairing code');
    }
  }

  async verifyPairing(deviceId: string, verificationCode: string): Promise<boolean> {
    const pairing = this.pairedDevices.get(deviceId);
    if (!pairing) {
      throw new Error('Device not found in pairing list');
    }

    // Simple verification using HMAC of shared secret
    const key = await window.crypto.subtle.importKey(
      'raw',
      pairing.sharedSecret,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    const data = new TextEncoder().encode(deviceId + pairing.timestamp);
    const signature = await window.crypto.subtle.sign('HMAC', key, data);
    const expectedCode = btoa(String.fromCharCode(...new Uint8Array(signature.slice(0, 6))));

    if (verificationCode === expectedCode) {
      pairing.verified = true;
      return true;
    }

    return false;
  }

  async encryptMessage(message: string | ArrayBuffer, recipientDeviceId: string): Promise<EncryptedMessage> {
    const pairing = this.pairedDevices.get(recipientDeviceId);
    if (!pairing || !pairing.verified) {
      throw new Error('Device not paired or verified');
    }

    // Convert message to ArrayBuffer if needed
    let messageBuffer: ArrayBuffer;
    if (typeof message === 'string') {
      messageBuffer = new TextEncoder().encode(message);
    } else {
      messageBuffer = message;
    }

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Import shared secret as AES-GCM key
    const key = await window.crypto.subtle.importKey(
      'raw',
      pairing.sharedSecret,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt the message
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      messageBuffer
    );

    const senderPublicKey = await this.getPublicKeyBytes();

    return {
      data: encryptedData,
      iv: iv.buffer,
      senderPublicKey
    };
  }

  async decryptMessage(encryptedMessage: EncryptedMessage, senderDeviceId: string): Promise<ArrayBuffer> {
    const pairing = this.pairedDevices.get(senderDeviceId);
    if (!pairing || !pairing.verified) {
      throw new Error('Device not paired or verified');
    }

    // Import shared secret as AES-GCM key
    const key = await window.crypto.subtle.importKey(
      'raw',
      pairing.sharedSecret,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt the message
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encryptedMessage.iv
      },
      key,
      encryptedMessage.data
    );

    return decryptedData;
  }

  private async deriveSharedSecret(otherPublicKey: CryptoKey): Promise<ArrayBuffer> {
    if (!this.keyPair) {
      throw new Error('Key pair not initialized');
    }

    // Derive shared secret using ECDH
    const sharedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: otherPublicKey
      },
      this.keyPair.privateKey,
      256 // 32 bytes for AES-256
    );

    return sharedBits;
  }

  getPairedDevices(): DevicePairing[] {
    return Array.from(this.pairedDevices.values());
  }

  isPaired(deviceId: string): boolean {
    const pairing = this.pairedDevices.get(deviceId);
    return pairing ? pairing.verified : false;
  }

  removePairing(deviceId: string): void {
    this.pairedDevices.delete(deviceId);
  }

  async rotateKeys(): Promise<void> {
    // Generate new key pair
    const newKeyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveKey', 'deriveBits']
    );

    this.keyPair = newKeyPair;

    // Clear existing pairings (they'll need to re-pair)
    this.pairedDevices.clear();
    
    console.log('Keys rotated - all devices must re-pair');
  }
}

export const createEncryptionService = (deviceId: string) => new EncryptionService(deviceId);
