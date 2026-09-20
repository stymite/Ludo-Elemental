import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';

export const WinnerModal = ({ visible, ranks, onNewGame }) => {
  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={!!visible}>
      <View style={styles.overlay}>
        <View style={[styles.menuModalContent, { width: '75%' }]}>
          <Text style={styles.menuTitle}>Game Over!</Text>
          
          <View style={styles.ranksContainer}>
            {Object.entries(ranks)
              .sort(([, a], [, b]) => a - b)
              .map(([player, rank]) => (
                <View key={player} style={styles.rankRow}>
                  <Text style={styles.rankText}>#{rank}</Text>
                  <View style={[styles.playerBadge, { backgroundColor: COLORS[player], borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1 }]}>
                    <Text style={styles.playerText}>{player}</Text>
                  </View>
                </View>
              ))}
          </View>

          <TouchableOpacity style={[styles.glassBtn, styles.glassGreen]} onPress={onNewGame}>
            <Text style={[styles.glassBtnText, { textShadowColor: 'rgba(76, 175, 80, 0.8)' }]}>Play Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const MenuModal = ({ visible, onResume, onNewGame, onExitToHome }) => {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={!!visible}>
      <View style={styles.overlay}>
        <View style={[styles.menuModalContent, { width: '75%' }]}>
          <Text style={styles.menuTitle}>Paused</Text>
          
          <TouchableOpacity style={[styles.glassBtn, styles.glassBlue]} onPress={onResume}>
            <Text style={[styles.glassBtnText, { textShadowColor: 'rgba(33, 150, 243, 0.8)' }]}>Continue</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.glassBtn, styles.glassYellow]} onPress={onNewGame}>
            <Text style={[styles.glassBtnText, { textShadowColor: 'rgba(255, 179, 0, 0.8)' }]}>Restart</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.glassBtn, styles.glassRed]} onPress={onExitToHome}>
            <Text style={[styles.glassBtnText, { textShadowColor: 'rgba(230, 0, 38, 0.8)' }]}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: COLORS.TEXT,
  },
  ranksContainer: {
    width: '100%',
    marginBottom: 24,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  rankText: {
    fontSize: 22,
    fontFamily: 'Nunito-Bold',
    width: 45,
    color: '#E0E0E0',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  playerBadge: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  playerText: {
    color: '#FFFFFF',
    fontFamily: 'Nunito-Bold',
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.GREEN,
    marginVertical: 8,
  },
  resumeBtn: {
    backgroundColor: COLORS.BLUE,
  },
  newGameBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.RED,
  },
  homeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#757575',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuModalContent: {
    width: '85%',
    backgroundColor: 'rgba(25, 28, 35, 0.9)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  menuTitle: {
    fontFamily: 'Aligarh',
    fontSize: 48,
    color: '#FFFFFF',
    marginBottom: 36,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  glassBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    borderWidth: 1.5,
  },
  glassBtnLeft: {
    justifyContent: 'flex-start',
    paddingHorizontal: 22,
  },
  btnIcon: {
    marginRight: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glassBlue: {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderColor: 'rgba(33, 150, 243, 0.6)',
  },
  glassYellow: {
    backgroundColor: 'rgba(255, 179, 0, 0.15)',
    borderColor: 'rgba(255, 179, 0, 0.6)',
  },
  glassRed: {
    backgroundColor: 'rgba(230, 0, 38, 0.15)',
    borderColor: 'rgba(230, 0, 38, 0.6)',
  },
  glassGreen: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderColor: 'rgba(76, 175, 80, 0.6)',
  },
  glassBtnText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
