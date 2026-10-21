const express = require('express');
const router = express.Router();
const editorService = require('../services/editorService');

router.get('/', async (req, res) => {
  try {
    const editors = await editorService.getAllEditors();
    res.json(editors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nama, kode, ...extra } = req.body;
    const editor = await editorService.addEditor(nama, kode, extra);
    res.status(201).json(editor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, kode, ...extra } = req.body;
    const editor = await editorService.updateEditor(id, nama, kode, extra);
    res.json(editor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await editorService.deleteEditor(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
