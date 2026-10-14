from pathlib import Path
import unittest
from html import unescape

ROOT = Path(__file__).resolve().parents[1]


class CommsCoursePagesTest(unittest.TestCase):
    def test_homepage_groups_comms_tools_separately(self):
        homepage = (ROOT / "index.html").read_text()
        self.assertIn("Comms Courses", homepage)
        self.assertIn("tools/comms-208-test-1-2026.html", homepage)
        self.assertIn("tools/comms-208-test-2-2026.html", homepage)

    def test_test_two_reuses_test_one_instructions_on_first_slide(self):
        page = unescape((ROOT / "tools/comms-208-test-2-2026.html").read_text())
        first_slide = page.split('id="slide-2"', 1)[0]
        self.assertIn("Test Day!!", first_slide)
        self.assertIn("All phones / devices", first_slide)
        self.assertIn("leave your bag at the front of the class", first_slide)
        self.assertIn("Handwritten notes", first_slide)
        self.assertIn("Optional:", first_slide)

    def test_second_slide_has_two_unheaded_reading_lists(self):
        page = unescape((ROOT / "tools/comms-208-test-2-2026.html").read_text())
        second_slide = page.split('id="slide-2"', 1)[1].split("</section>", 1)[0]
        self.assertEqual(second_slide.count("<ol"), 2)
        self.assertIn("First half readings", second_slide)
        self.assertIn("Second half readings", second_slide)
        for title in (
            "AI Essentials Canvas Course", "Anatomy of an AI System",
            "Benefits of AI in healthcare for Aotearoa NZ", "Physiognomy’s New Clothes",
            "AI Ethics: Seven Traps", "Principles of Māori Data Sovereignty",
            "Data Feminism: The Power Chapter", "Ethics & Info. Technology",
            "Plagiarism and Copyright Infringement", "IP and Confucianism",
            "Milestones in the History of Info. and Computer Ethics",
            "A Moral Panic: ChatGPT and the Gamification of Education",
            "Contra Literacy-Laundering: Mechanistic Critical AI Literacy",
            "Contestation of Tech Ethics",
            "Political Effects of the Internet and Social Media",
            "Algorithmic Decision-Making And Accountability Case Study",
            "AI making benefit decisions", "Bigger Brother", "The Coup We Are Not Talking About",
            "Will AI Take My Job? With Karen Hao", "Deepfakes and Democracy",
            "The Algorithmic Colonization of Africa", "Yellow Techno-Peril",
            "AI is trash", "A New AI Lexicon: Maintenance",
        ):
            with self.subTest(title=title):
                self.assertIn(title, second_slide)


if __name__ == "__main__":
    unittest.main()
