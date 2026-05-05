import React from 'react';
import {
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
  View,
  StyleSheet,
} from 'react-native';
import { ThemedText } from './ThemedText';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../hooks/useTheme';

type Item = { label: string; value: string };

type Props = {
  visible: boolean;
  title: string;
  items: Item[];
  value: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export const AppPickerModal: React.FC<Props> = ({
  visible,
  title,
  items,
  value,
  onSelect,
  onClose,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View
                style={[styles.header, { borderBottomColor: colors.border ?? colors.text + '22' }]}
              >
                <ThemedText style={styles.title}>{title}</ThemedText>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ maxHeight: 320 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {items.map((item, idx) => {
                  const selected = item.value === value;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      onPress={() => {
                        onSelect(item.value);
                        onClose();
                      }}
                      style={[
                        styles.item,
                        selected && { backgroundColor: colors.primary + '22' },
                        idx < items.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border ?? colors.text + '22',
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.itemText,
                          selected && { color: colors.primary, fontWeight: '600' },
                        ]}
                      >
                        {item.label}
                      </ThemedText>
                      {selected && <Icon name="check" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontWeight: '700',
    fontSize: 17,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  itemText: {
    fontSize: 15,
    flex: 1,
  },
});
