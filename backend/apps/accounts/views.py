from rest_framework import generics, permissions
from rest_framework.response import Response

from .serializers import UserPublicSerializer, UserRegistrationSerializer


class RegisterUserView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = UserRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        response_serializer = UserPublicSerializer(user)
        return Response(
            {
                "message": "User registered successfully.",
                "user": response_serializer.data,
            },
            status=201,
        )
