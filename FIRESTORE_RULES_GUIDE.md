# Firestore Security Rules Deployment Guide

## 📋 What These Rules Do:

**Settings & Manual:**

- ✅ Any authenticated user can **read**
- ✅ Only **admins** can **write/update**

**User Profiles:**

- ✅ Users can **read their own** profile
- ✅ Admins can **read all** profiles
- ✅ Only **admins** can create/update profiles
- ✅ Users can update their **own lastLogin** field

---

## 🚀 How to Deploy:

### **Method 1: Firebase Console (Easy)**

1. Go to https://console.firebase.google.com/
2. Select your "galvaniy-labs" project
3. Click **"Firestore Database"** in sidebar
4. Click **"Rules"** tab at the top
5. **Copy the entire contents** of `firestore.rules`
6. **Paste** into the rules editor
7. Click **"Publish"**

### **Method 2: Firebase CLI (Advanced)**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

---

## ✅ Verify Rules:

After deploying, test:

1. **As Student:** Can read manual ✓
2. **As Student:** Cannot upload manual ✗
3. **As Admin:** Can upload manual ✓
4. **As Admin:** Can see all users ✓

---

**Deploy these rules BEFORE testing the app!**
