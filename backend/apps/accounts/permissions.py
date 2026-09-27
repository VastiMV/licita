from rest_framework.permissions import BasePermission


class EhSuperusuario(BasePermission):
    """Só o super usuário configura o produto: o armazenamento (para onde vão
    os documentos da empresa) e quem tem acesso a ele (os usuários).

    É o único papel que existe. Quem não é super usuário usa o produto
    inteiro, menos Configurações.
    """

    message = "Só o super usuário pode fazer isto."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
