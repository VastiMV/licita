from django.test import TestCase

from .models import User


class UserManagerTests(TestCase):
    def test_create_user_define_email_normalizado_e_senha_com_hash(self):
        user = User.objects.create_user(email="Gustavo@Licita.dev", password="uma-senha-forte")

        self.assertEqual(user.email, "Gustavo@licita.dev")
        self.assertTrue(user.check_password("uma-senha-forte"))
        self.assertNotEqual(user.password, "uma-senha-forte")

    def test_create_user_sem_email_levanta_erro(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="uma-senha-forte")

    def test_create_user_nao_e_staff_nem_superuser_por_padrao(self):
        user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")

        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_active)

    def test_create_superuser_e_staff_e_superuser(self):
        admin = User.objects.create_superuser(email="admin@licita.dev", password="uma-senha-forte")

        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

    def test_create_superuser_com_is_staff_false_levanta_erro(self):
        with self.assertRaises(ValueError):
            User.objects.create_superuser(email="admin@licita.dev", password="x", is_staff=False)

    def test_create_superuser_com_is_superuser_false_levanta_erro(self):
        with self.assertRaises(ValueError):
            User.objects.create_superuser(email="admin@licita.dev", password="x", is_superuser=False)


class UserModelTests(TestCase):
    def test_login_e_por_email_nao_por_username(self):
        self.assertEqual(User.USERNAME_FIELD, "email")
        self.assertEqual(User.REQUIRED_FIELDS, [])

    def test_str_devolve_o_email(self):
        user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")

        self.assertEqual(str(user), "user@licita.dev")

    def test_dois_usuarios_nao_podem_ter_o_mesmo_email(self):
        User.objects.create_user(email="duplicado@licita.dev", password="x")

        with self.assertRaises(Exception):
            User.objects.create_user(email="duplicado@licita.dev", password="y")
