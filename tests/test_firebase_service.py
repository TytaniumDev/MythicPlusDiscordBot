"""Unit tests for FirebaseService, focusing on optimization and batch operations."""

import os
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.firebase_service import FirebaseService


class TestFirebaseServiceDeletion(unittest.IsolatedAsyncioTestCase):
    """Tests for FirebaseService.delete_sessions_older_than optimization."""

    def setUp(self):
        # Reset the singleton if needed, but we are patching everything so maybe not critical.
        # Ideally we should mock the db on a new instance.
        self.service = FirebaseService()
        self.mock_db = MagicMock()
        self.service.db = self.mock_db

    async def test_delete_sessions_older_than_no_docs(self):
        """Verify behavior when no documents match."""
        # Setup mock chain
        mock_collection = MagicMock()
        mock_query = MagicMock()
        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = []  # No documents

        deleted = await self.service.delete_sessions_older_than(3600)

        self.assertEqual(deleted, 0)
        # Batch might be created but commit should not be called
        if self.mock_db.batch.called:
            self.mock_db.batch.return_value.commit.assert_not_called()

    async def test_delete_sessions_older_than_single_batch(self):
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

        deleted = await self.service.delete_sessions_older_than(3600)

        self.assertEqual(deleted, num_docs)

        # Verify batch usage
        self.mock_db.batch.assert_called()
        self.assertEqual(mock_batch.delete.call_count, num_docs)
        mock_batch.commit.assert_called()

        # Verify individual delete was NOT called directly on doc ref
        for doc in mock_docs:
            doc.reference.delete.assert_not_called()

    async def test_delete_sessions_older_than_multi_batch(self):
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

        # We need mock_db.batch() to return a NEW batch object each time it is called
        # so we can track commits separately, or at least verify commit count.
        batch1 = MagicMock()
        batch2 = MagicMock()
        self.mock_db.batch.side_effect = [batch1, batch2]

        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = mock_docs

        deleted = await self.service.delete_sessions_older_than(3600)

        self.assertEqual(deleted, num_docs)

        # Verify batch usage
        self.assertEqual(self.mock_db.batch.call_count, 2)

        # First batch should have 500 deletes
        self.assertEqual(batch1.delete.call_count, 500)
        batch1.commit.assert_called_once()

        # Second batch should have 50 deletions
        self.assertEqual(batch2.delete.call_count, 50)
        batch2.commit.assert_called_once()

    async def test_delete_sessions_exact_batch_boundary(self):
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
        # If it tries to create a second batch for 0 items, that might be okay or not depending on implementation.
        # Usually loop finishes and we commit what we have.
        # But if we commit every 500 items inside loop, we might not have a leftover batch.
        # Let's see how implementation handles it. Ideally 1 batch.
        self.mock_db.batch.side_effect = [batch1, MagicMock()]

        self.mock_db.collection.return_value = mock_collection
        mock_collection.where.return_value = mock_query
        mock_query.stream.return_value = mock_docs

        deleted = await self.service.delete_sessions_older_than(3600)

        self.assertEqual(deleted, num_docs)

        # Expecting 1 batch if we commit at end, or 1 batch if we chunk perfectly.
        # If implementation commits immediately upon reaching 500, we expect 1 commit.
        # If implementation collects remaining and commits, and remaining is 0, it shouldn't commit empty batch.

        # We'll assert at least 1 commit.
        batch1.commit.assert_called()
        self.assertEqual(batch1.delete.call_count, 500)


if __name__ == "__main__":
    unittest.main()
