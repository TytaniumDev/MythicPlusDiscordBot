"""Unit tests for FirebaseService, focusing on cleanup and batch operations."""

import os
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.firebase_service import FirebaseService


class TestFirebaseServiceDeleteOldDocs(unittest.IsolatedAsyncioTestCase):
    """Tests for FirebaseService.delete_old_docs (generalized cleanup)."""

    def setUp(self):
        self.service = FirebaseService()
        self.mock_db = MagicMock()
        self.service.db = self.mock_db

    async def test_delete_old_docs_no_docs(self):
        """Verify behavior when no documents match."""
        mock_collection = MagicMock()
        mock_query = MagicMock()
        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = []

        deleted = await self.service.delete_old_docs("channels", 3600)

        self.assertEqual(deleted, 0)
        if self.mock_db.batch.called:
            self.mock_db.batch.return_value.commit.assert_not_called()

    async def test_delete_old_docs_single_batch(self):
        """Verify batch deletion for < 500 docs (e.g. 10)."""
        num_docs = 10
        mock_docs = []
        for i in range(num_docs):
            doc = MagicMock()
            doc.id = f"doc_{i}"
            doc.reference = MagicMock()
            mock_docs.append(doc)

        mock_collection = MagicMock()
        mock_query = MagicMock()
        mock_batch = MagicMock()

        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = mock_docs
        self.mock_db.batch.return_value = mock_batch

        deleted = await self.service.delete_old_docs("guilds", 3600)

        self.assertEqual(deleted, num_docs)
        self.mock_db.batch.assert_called()
        self.assertEqual(mock_batch.delete.call_count, num_docs)
        mock_batch.commit.assert_called()

        for doc in mock_docs:
            doc.reference.delete.assert_not_called()

    async def test_delete_old_docs_multi_batch(self):
        """Verify batch deletion for > 500 docs (e.g. 550)."""
        num_docs = 550
        mock_docs = []
        for i in range(num_docs):
            doc = MagicMock()
            doc.id = f"doc_{i}"
            doc.reference = MagicMock()
            mock_docs.append(doc)

        mock_collection = MagicMock()
        mock_query = MagicMock()

        batch1 = MagicMock()
        batch2 = MagicMock()
        self.mock_db.batch.side_effect = [batch1, batch2]

        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = mock_docs

        deleted = await self.service.delete_old_docs("channels", 3600)

        self.assertEqual(deleted, num_docs)
        self.assertEqual(self.mock_db.batch.call_count, 2)
        self.assertEqual(batch1.delete.call_count, 500)
        batch1.commit.assert_called_once()
        self.assertEqual(batch2.delete.call_count, 50)
        batch2.commit.assert_called_once()

    async def test_delete_old_docs_exact_batch_boundary(self):
        """Verify behavior when doc count is exactly 500."""
        num_docs = 500
        mock_docs = []
        for i in range(num_docs):
            doc = MagicMock()
            doc.id = f"doc_{i}"
            doc.reference = MagicMock()
            mock_docs.append(doc)

        mock_collection = MagicMock()
        mock_query = MagicMock()
        batch1 = MagicMock()
        self.mock_db.batch.side_effect = [batch1, MagicMock()]

        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = mock_docs

        deleted = await self.service.delete_old_docs("guilds", 3600)

        self.assertEqual(deleted, num_docs)
        batch1.commit.assert_called()
        self.assertEqual(batch1.delete.call_count, 500)

    async def test_delete_old_docs_works_for_both_collections(self):
        """Verify it works for guilds and channels collections."""
        mock_collection = MagicMock()
        mock_query = MagicMock()
        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = []

        await self.service.delete_old_docs("guilds", 3600)
        self.mock_db.collection.assert_called_with("guilds")

        await self.service.delete_old_docs("channels", 3600)
        self.mock_db.collection.assert_called_with("channels")


class TestFirebaseServiceDeleteAllInCollection(unittest.IsolatedAsyncioTestCase):
    """Tests for FirebaseService.delete_all_in_collection."""

    def setUp(self):
        self.service = FirebaseService()
        self.mock_db = MagicMock()
        self.service.db = self.mock_db

    async def test_delete_all_empty_collection(self):
        mock_collection = MagicMock()
        self.mock_db.collection.return_value = mock_collection
        mock_collection.stream.return_value = []

        deleted = await self.service.delete_all_in_collection("sessions")
        self.assertEqual(deleted, 0)

    async def test_delete_all_with_docs(self):
        mock_docs = []
        for _i in range(3):
            doc = MagicMock()
            doc.reference = MagicMock()
            mock_docs.append(doc)

        mock_collection = MagicMock()
        mock_batch = MagicMock()
        self.mock_db.collection.return_value = mock_collection
        mock_collection.stream.return_value = mock_docs
        self.mock_db.batch.return_value = mock_batch

        deleted = await self.service.delete_all_in_collection("sessions")
        self.assertEqual(deleted, 3)
        self.assertEqual(mock_batch.delete.call_count, 3)
        mock_batch.commit.assert_called()


if __name__ == "__main__":
    unittest.main()
