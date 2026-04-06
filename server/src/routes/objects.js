const router = require('express').Router();
const { prisma } = require('../lib/prisma');
const { makeUploader, uploadBufferToCloudinary, deleteByPublicId } = require('../lib/cloudinary');
const { authenticateJWT, authorizeRole, scopeFilter, canModify, paginateQuery, paginatedResponse } = require('../middleware/auth');

const upload = makeUploader();

// GET /api/objects
router.get('/', authenticateJWT, authorizeRole('admin', 'specialist'), scopeFilter('objects'), async (req, res, next) => {
  try {
    const { page, limit, skip, take } = paginateQuery(req.query);
    const { search, category_id, scope } = req.query;

    let where = { ...req.scope };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (category_id) where.categoryId = category_id;
    if (scope === 'own')    where = { ownerId: req.user.sub };
    if (scope === 'public') where = { ownerId: null, status: 'approved' };

    const [data, total] = await Promise.all([
      prisma.object.findMany({
        where, skip, take,
        include: { representations: true, category: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.object.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e) { next(e); }
});

// GET /api/objects/:id
router.get('/:id', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const obj = await prisma.object.findUnique({
      where: { id: req.params.id },
      include: { representations: true, category: true, owner: { select: { id: true, name: true } } },
    });
    if (!obj) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    res.json({ success: true, data: obj });
  } catch (e) { next(e); }
});

// POST /api/objects
router.post('/', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const { name, category_id, em, is_public } = req.body;
    const ownerId = req.user.role === 'admin' && is_public ? null : req.user.sub;
    const status  = req.user.role === 'admin' && is_public ? 'approved' : 'private';

    const obj = await prisma.object.create({
      data: { name, em: em || '📦', categoryId: category_id, ownerId, status },
      include: { representations: true, category: { select: { id: true, name: true } } },
    });
    res.status(201).json({ success: true, data: obj });
  } catch (e) { next(e); }
});

// PATCH /api/objects/:id
router.patch('/:id', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const obj = await prisma.object.findUnique({ where: { id: req.params.id } });
    if (!obj) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, obj)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });

    const { name, category_id, em } = req.body;
    const updated = await prisma.object.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(category_id && { categoryId: category_id }),
        ...(typeof em === 'string' && { em }),
      },
      include: { representations: true, category: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
});

// DELETE /api/objects/:id
router.delete('/:id', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const obj = await prisma.object.findUnique({
      where: { id: req.params.id }, include: { representations: true },
    });
    if (!obj) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, obj)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });

    const inUse = await prisma.activityObject.count({ where: { objectId: obj.id } });
    if (inUse > 0) return res.status(409).json({ success: false, error: { code: 'OBJECT_IN_USE' } });

    // Delete Cloudinary assets
    for (const rep of obj.representations) {
      if (rep.cloudinaryPublicId) await deleteByPublicId(rep.cloudinaryPublicId);
    }
    await prisma.object.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  } catch (e) { next(e); }
});

// ── Representations ──────────────────────────────────────────────────────────

// GET /api/objects/:id/representations
router.get('/:id/representations', authenticateJWT, async (req, res, next) => {
  try {
    const reps = await prisma.objectRepresentation.findMany({ where: { objectId: req.params.id } });
    res.json({ success: true, data: reps });
  } catch (e) { next(e); }
});

// POST /api/objects/:id/representations  (level 1 = JSON url; levels 2&3 = multipart file)
router.post('/:id/representations', authenticateJWT, authorizeRole('admin', 'specialist'), (req, res, next) => {
  // Check if it's a 3D URL (JSON) or file upload
  if (req.headers['content-type']?.includes('application/json')) {
    return next();
  }
  upload.single('file')(req, res, next);
}, async (req, res, next) => {
  try {
    // ✅ IMPLEMENTADO: representaciones con memoryStorage + upload_stream a Cloudinary.
    const obj = await prisma.object.findUnique({ where: { id: req.params.id } });
    if (!obj) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, obj)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });

    const { level, model_3d_url } = req.body;
    const levelMap = { '1': 'model_3d', '2': 'photo', '3': 'drawing' };
    const lvlEnum = levelMap[level];
    if (!lvlEnum) return res.status(400).json({ success: false, error: { code: 'INVALID_LEVEL' } });

    let data = { objectId: obj.id, level: lvlEnum };

    if (level === '1') {
      if (!model_3d_url) return res.status(400).json({ success: false, error: { code: 'MISSING_URL' } });
      data.mediaType = 'model_3d_url';
      data.model3dUrl = model_3d_url;
    } else if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'representations');
      const existing = await prisma.objectRepresentation.findUnique({
        where: { objectId_level: { objectId: obj.id, level: lvlEnum } },
      });
      if (existing?.cloudinaryPublicId) await deleteByPublicId(existing.cloudinaryPublicId);

      data.mediaType = 'image_upload';
      data.fileUrl = uploaded.secure_url;
      data.cloudinaryPublicId = uploaded.public_id;
    } else {
      return res.status(400).json({ success: false, error: { code: 'NO_FILE' } });
    }

    const rep = await prisma.objectRepresentation.upsert({
      where:  { objectId_level: { objectId: obj.id, level: lvlEnum } },
      create: data,
      update: data,
    });
    res.status(201).json({ success: true, data: rep });
  } catch (e) { next(e); }
});

// DELETE /api/objects/:id/representations/:level
router.delete('/:id/representations/:level', authenticateJWT, authorizeRole('admin', 'specialist'), async (req, res, next) => {
  try {
    const lvlMap = { '1': 'model_3d', '2': 'photo', '3': 'drawing' };
    const lvlEnum = lvlMap[req.params.level];
    if (!lvlEnum) return res.status(400).json({ success: false, error: { code: 'INVALID_LEVEL' } });

    const obj = await prisma.object.findUnique({ where: { id: req.params.id } });
    if (!obj) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    if (!canModify(req.user, obj)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });

    const rep = await prisma.objectRepresentation.findUnique({
      where: { objectId_level: { objectId: req.params.id, level: lvlEnum } },
    });
    if (rep?.cloudinaryPublicId) await deleteByPublicId(rep.cloudinaryPublicId);
    await prisma.objectRepresentation.deleteMany({
      where: { objectId: req.params.id, level: lvlEnum },
    });
    res.json({ success: true, data: { object_id: req.params.id, level: lvlEnum, deleted: true } });
  } catch (e) { next(e); }
});

module.exports = router;
