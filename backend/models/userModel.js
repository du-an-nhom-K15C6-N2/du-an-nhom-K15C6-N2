/**
 * TTCS Classroom Security Application - User Model
 * Adapter for backward compatibility delegating to UserRepository
 */

const userRepository = require('../repositories/userRepository');

class UserModel {
  static findAll(options) {
    return userRepository.findAll(options);
  }

  static getAllRaw() {
    return userRepository.getAllRaw();
  }

  static findById(id) {
    return userRepository.findById(id);
  }

  static findByEmail(email) {
    return userRepository.findByEmail(email);
  }

  static findByActivationToken(token) {
    return userRepository.findByActivationToken(token);
  }

  static create(userData) {
    // Validate duplicate email
    if (userData.email) {
      const existing = userRepository.findByEmail(userData.email);
      if (existing) {
        throw new Error(`Email '${userData.email}' đã tồn tại trong hệ thống. Vui lòng sử dụng email khác.`);
      }
    }
    return userRepository.create(userData);
  }

  static update(id, userData) {
    if (userData.email) {
      const existing = userRepository.findByEmail(userData.email);
      if (existing && existing.id !== id) {
        throw new Error(`Email '${userData.email}' đã được sử dụng bởi một tài khoản khác.`);
      }
    }
    return userRepository.update(id, userData);
  }

  static toggleLock(id) {
    return userRepository.toggleLock(id);
  }

  static delete(id) {
    return userRepository.delete(id);
  }

  static reset() {
    return userRepository.reset();
  }
}

module.exports = UserModel;
