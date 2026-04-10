import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DEFAULT_CATEGORIES } from '@/src/constants/categories';
import { EmptyState } from '@/src/components/common/EmptyState';
import { FormField } from '@/src/components/common/FormField';
import { GlowCard } from '@/src/components/common/GlowCard';
import { PrimaryButton } from '@/src/components/common/PrimaryButton';
import { Screen } from '@/src/components/common/Screen';
import { SecondaryButton } from '@/src/components/common/SecondaryButton';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useExpenseData } from '@/src/providers/DataProvider';
import { ExpenseItem, ReceiptPayload } from '@/src/types';
import { inferMimeType, isAllowedReceiptFile } from '@/src/utils/file';

const emptyPayload: ReceiptPayload = {
  vendor: '',
  amount: '',
  currency: 'INR',
  category: DEFAULT_CATEGORIES[0],
  date: new Date().toISOString().slice(0, 10),
  items: [],
};

export function UploadReceiptScreen() {
  const { processReceipt, saveProcessedReceipt } = useExpenseData();
  const [mode, setMode] = useState<'file' | 'manual'>('file');
  const [payload, setPayload] = useState<ReceiptPayload>(emptyPayload);
  const [itemDraft, setItemDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'error' | 'success'>('error');

  const applyAsset = async (asset: { uri: string; name: string; mimeType?: string }) => {
    if (!isAllowedReceiptFile({ name: asset.name })) {
      setTone('error');
      setMessage('Accepted file types are JPG, JPEG, PNG, GIF, BMP, and PDF.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const extracted = await processReceipt({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? inferMimeType(asset.name),
      });
      setPayload(extracted);
      setTone('success');
      setMessage('Receipt processed. Review and edit the extracted data before saving.');
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'Receipt processing failed.');
    } finally {
      setLoading(false);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      type: ['image/*', 'application/pdf'],
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      await applyAsset(asset);
    }
  };

  const captureReceipt = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setTone('error');
      setMessage('Camera permission is required to capture a receipt.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      const asset = result.assets[0];
      await applyAsset({
        uri: asset.uri,
        name: asset.fileName ?? `receipt-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
      });
    }
  };

  const importImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setTone('error');
      setMessage('Media library permission is required to import a receipt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled) {
      const asset = result.assets[0];
      await applyAsset({
        uri: asset.uri,
        name: asset.fileName ?? `receipt-${Date.now()}.jpg`,
        mimeType: asset.mimeType,
      });
    }
  };

  const addItem = () => {
    if (!itemDraft.trim()) return;
    const nextItem: ExpenseItem = { name: itemDraft.trim() };
    setPayload((current) => ({ ...current, items: [...current.items, nextItem] }));
    setItemDraft('');
  };

  const save = async () => {
    setLoading(true);
    setMessage('');
    try {
      await saveProcessedReceipt(payload);
      setPayload(emptyPayload);
      setTone('success');
      setMessage('Expense saved successfully.');
    } catch (error) {
      setTone('error');
      setMessage(error instanceof Error ? error.message : 'Unable to save expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <GlowCard>
        <ThemedText variant="title">Upload Receipt</ThemedText>
        <ThemedText>
          Switch between file upload mode and manual entry mode while keeping the same save-expense flow.
        </ThemedText>
        <View style={styles.toggleRow}>
          <SecondaryButton label="File Upload Mode" onPress={() => setMode('file')} style={mode === 'file' ? styles.activeMode : undefined} />
          <SecondaryButton label="Manual Entry Mode" onPress={() => setMode('manual')} style={mode === 'manual' ? styles.activeMode : undefined} />
        </View>
      </GlowCard>

      {message ? <StatusBanner message={message} tone={tone} /> : null}

      {mode === 'file' ? (
        <GlowCard>
          <PrimaryButton label="Import PDF or Image Receipt" onPress={pickDocument} loading={loading} />
          <SecondaryButton label="Capture Receipt From Camera" onPress={captureReceipt} />
          <SecondaryButton label="Import Receipt Image" onPress={importImage} />
        </GlowCard>
      ) : null}

      <GlowCard>
        <ThemedText variant="subtitle">Editable extracted data</ThemedText>
        <FormField label="Vendor" value={payload.vendor} onChangeText={(value) => setPayload((current) => ({ ...current, vendor: value }))} />
        <FormField label="Amount" value={payload.amount} onChangeText={(value) => setPayload((current) => ({ ...current, amount: value }))} keyboardType="decimal-pad" />
        <FormField label="Currency" value={payload.currency} onChangeText={(value) => setPayload((current) => ({ ...current, currency: value }))} autoCapitalize="characters" />
        <FormField label="Category" value={payload.category} onChangeText={(value) => setPayload((current) => ({ ...current, category: value }))} helperText={DEFAULT_CATEGORIES.join(' | ')} />
        <FormField label="Date" value={payload.date} onChangeText={(value) => setPayload((current) => ({ ...current, date: value }))} placeholder="YYYY-MM-DD" />
        <View style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <FormField label="Item" value={itemDraft} onChangeText={setItemDraft} />
          </View>
          <Pressable onPress={addItem} style={styles.itemAdd}>
            <ThemedText variant="badge">Add</ThemedText>
          </Pressable>
        </View>
        {payload.items.length ? (
          payload.items.map((item, index) => (
            <ThemedText key={`${item.name}-${index}`} variant="caption">
              {index + 1}. {item.name}
            </ThemedText>
          ))
        ) : (
          <EmptyState title="Items" body="Extracted receipt items will appear here, and you can add manual items too." />
        )}
        <PrimaryButton label="Save Expense" onPress={save} loading={loading} />
      </GlowCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    gap: 10,
  },
  activeMode: {
    opacity: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  itemAdd: {
    minHeight: 52,
    justifyContent: 'center',
    paddingBottom: 10,
  },
});
