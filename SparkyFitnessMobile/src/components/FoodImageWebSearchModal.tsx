import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCSSVariable } from 'uniwind';
import type { FoodImageSearchResult } from '@workspace/shared';
import FullScreenModalBody from './FullScreenModalBody';
import FormInput from './FormInput';
import Button from './ui/Button';
import Icon from './Icon';
import SafeImage from './SafeImage';
import {
  useDownloadFoodImage,
  useFoodImageSearch,
} from '../hooks/useFoodImageSearch';
import { getApiErrorMessage } from '../services/api/errors';
import { addLog } from '../services/LogService';

const COLUMNS = 3;
const GAP = 8;
const SIDE_PADDING = 16;

interface FoodImageWebSearchModalProps {
  visible: boolean;
  /** What to search for first, usually the food's brand and name. */
  initialQuery: string;
  onClose: () => void;
  /** Called with the downloaded image's file URI; the modal then closes. */
  onImagePicked: (uri: string) => void;
}

/**
 * Searches the web for a food photo. A picked result is saved to the cache
 * through the server and handed back as a file URI, so the picker stages it
 * exactly like a photo from the library and it uploads on Save.
 */
const FoodImageWebSearchModal: React.FC<FoodImageWebSearchModalProps> = ({
  visible,
  initialQuery,
  onClose,
  onImagePicked,
}) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [textPrimary, textMuted, accent] = useCSSVariable([
    '--color-text-primary',
    '--color-text-muted',
    '--color-accent-primary',
  ]) as [string, string, string];

  const [draft, setDraft] = useState(initialQuery);
  const [submitted, setSubmitted] = useState(initialQuery.trim());
  const [pickingUrl, setPickingUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  // Each opening starts from the food's current name and searches it at once:
  // opening the modal is the request to search.
  useEffect(() => {
    if (visible) {
      setDraft(initialQuery);
      setSubmitted(initialQuery.trim());
      setPickingUrl(null);
      setPickError(null);
    }
  }, [visible, initialQuery]);

  const search = useFoodImageSearch(visible ? submitted : '');
  const download = useDownloadFoodImage();

  const tile = Math.floor(
    (width - SIDE_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS
  );

  const submit = () => {
    setPickError(null);
    setSubmitted(draft.trim());
  };

  const pick = async (result: FoodImageSearchResult) => {
    if (pickingUrl) return;
    setPickingUrl(result.url);
    setPickError(null);
    try {
      const uri = await download.mutateAsync(result);
      onImagePicked(uri);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`[Food Image Search] Download failed: ${message}`, 'ERROR');
      setPickError(
        t('foodImagePicker.webSearch.pickFailed', {
          defaultValue: "Couldn't get that image. Pick another one.",
        })
      );
    } finally {
      setPickingUrl(null);
    }
  };

  const data = search.data;
  const results = data?.status === 'ok' ? data.results : [];

  const renderBody = () => {
    if (submitted.length === 0) {
      return (
        <Text className="text-text-muted text-sm text-center mt-10">
          {t('foodImagePicker.webSearch.enterWords', {
            defaultValue: 'Type what to search for.',
          })}
        </Text>
      );
    }
    if (search.isLoading) {
      return (
        <View className="mt-12 items-center">
          <ActivityIndicator
            color={accent}
            accessibilityLabel={t('foodImagePicker.webSearch.searching', {
              defaultValue: 'Searching…',
            })}
          />
        </View>
      );
    }
    if (search.isError) {
      return (
        <View className="mt-10 items-center px-4" style={{ gap: 12 }}>
          <Text className="text-text-danger text-sm text-center">
            {getApiErrorMessage(search.error) ??
              t('foodImagePicker.webSearch.searchFailed', {
                defaultValue: 'Image search failed. Try again.',
              })}
          </Text>
          <Button variant="outline" onPress={() => void search.refetch()}>
            {t('foodImagePicker.webSearch.tryAgain', {
              defaultValue: 'Try again',
            })}
          </Button>
        </View>
      );
    }
    if (data?.status === 'not_configured') {
      return (
        <View className="mt-10 px-4" style={{ gap: 6 }}>
          <Text className="text-text-primary text-base font-semibold text-center">
            {t('foodImagePicker.webSearch.notConfiguredTitle', {
              defaultValue: 'Web image search is not set up',
            })}
          </Text>
          <Text className="text-text-secondary text-sm text-center">
            {t('foodImagePicker.webSearch.notConfiguredBody', {
              defaultValue:
                'On the web app, add a Brave Search API key in Settings › External Providers, then search again.',
            })}
          </Text>
        </View>
      );
    }
    if (results.length === 0) {
      return (
        <Text className="text-text-muted text-sm text-center mt-10">
          {t('foodImagePicker.webSearch.noResults', {
            defaultValue: 'No images found. Try other words.',
          })}
        </Text>
      );
    }
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => item.url}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ gap: GAP, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListFooterComponent={
          <Text className="text-text-muted text-xs mt-2">
            {t('foodImagePicker.webSearch.attribution', {
              defaultValue:
                'Results from Brave Search. Check you may use a photo before sharing it.',
            })}
          </Text>
        }
        renderItem={({ item }) => {
          const picking = pickingUrl === item.url;
          return (
            <Pressable
              onPress={() => void pick(item)}
              disabled={pickingUrl !== null}
              accessibilityRole="button"
              accessibilityLabel={t('foodImagePicker.webSearch.useImage', {
                defaultValue: 'Use image from {{source}}',
                source: item.source || item.title,
              })}
              testID={`food-web-image-${item.url}`}
              style={({ pressed }) => ({
                width: tile,
                opacity:
                  pickingUrl !== null && !picking ? 0.5 : pressed ? 0.7 : 1,
              })}
            >
              <View>
                <SafeImage
                  source={{ uri: item.thumbnailUrl, headers: {} }}
                  style={{ width: tile, height: tile, borderRadius: 8 }}
                  contentFit="cover"
                />
                {picking ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/40 rounded-lg">
                    <ActivityIndicator color="#ffffff" />
                  </View>
                ) : null}
              </View>
              <Text
                className="text-text-muted text-[11px] mt-1"
                numberOfLines={1}
              >
                {item.source}
              </Text>
            </Pressable>
          );
        }}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <FullScreenModalBody className="px-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-text-primary text-xl font-bold flex-1">
            {t('foodImagePicker.webSearch.title', {
              defaultValue: 'Search the web',
            })}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            className="p-2 rounded-full bg-surface border border-border-subtle"
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          >
            <Icon name="close" size={20} color={textPrimary} />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <FormInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('foodImagePicker.webSearch.placeholder', {
              defaultValue: 'Food name and brand',
            })}
            accessibilityLabel={t('foodImagePicker.webSearch.queryLabel', {
              defaultValue: 'Search for',
            })}
            returnKeyType="search"
            onSubmitEditing={submit}
            maxLength={200}
            autoCorrect={false}
            className="flex-1"
            testID="food-web-image-query"
          />
          <TouchableOpacity
            onPress={submit}
            disabled={draft.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel={t('foodImagePicker.webSearch.search', {
              defaultValue: 'Search',
            })}
            className="p-3 rounded-lg bg-raised border border-border-subtle"
            style={{ opacity: draft.trim().length === 0 ? 0.4 : 1 }}
          >
            <Icon name="search" size={20} color={textMuted} />
          </TouchableOpacity>
        </View>

        {pickError ? (
          <Text
            className="text-text-danger text-sm mb-2"
            accessibilityLiveRegion="polite"
          >
            {pickError}
          </Text>
        ) : null}

        <View className="flex-1">{renderBody()}</View>
      </FullScreenModalBody>
    </Modal>
  );
};

export default FoodImageWebSearchModal;
