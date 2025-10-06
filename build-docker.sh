#!/bin/bash

# OrangeTV Docker 镜像构建脚本
# 支持构建多种架构的Docker镜像

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检测系统架构
detect_platform() {
    local platform=""
    local arch=$(uname -m)
    local os=$(uname -s)
    
    case "$arch" in
        x86_64|amd64)
            platform="linux/amd64"
            ;;
        aarch64|arm64)
            platform="linux/arm64"
            ;;
        armv7l|armv7)
            platform="linux/arm/v7"
            ;;
        i386|i686)
            platform="linux/386"
            ;;
        *)
            # 默认使用 amd64
            platform="linux/amd64"
            echo -e "${YELLOW}警告: 无法识别的架构 $arch，使用默认架构 linux/amd64${NC}"
            ;;
    esac
    
    echo "$platform"
}

# 默认配置
IMAGE_NAME="orangetv"
# 默认使用当前系统架构
CURRENT_PLATFORM=$(detect_platform)
PLATFORMS="$CURRENT_PLATFORM"
DOCKERFILE="Dockerfile"
BUILD_CONTEXT="."
REGISTRY=""
TAG="latest"

# 显示帮助信息
show_help() {
    echo "OrangeTV Docker 镜像构建脚本"
    echo "支持构建多种架构的Docker镜像"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help              显示帮助信息"
    echo "  -i, --image NAME        镜像名称 (默认: orangetv)"
    echo "  -p, --platforms LIST    构建平台列表 (默认: $CURRENT_PLATFORM)"
    echo "  -f, --file DOCKERFILE   Dockerfile路径 (默认: Dockerfile)"
    echo "  -t, --tag TAG           镜像标签 (默认: latest)"
    echo "  -r, --registry REGISTRY 镜像仓库地址"
    echo "  --push                  推送镜像到仓库"
    echo "  --single-arch ARCH      单架构构建 (例如: linux/amd64)"
    echo ""
    echo "Examples:"
    echo "  $0                           # 构建当前系统架构镜像"
    echo "  $0 --single-arch linux/amd64 # 仅构建AMD64架构"
    echo "  $0 -p \"linux/amd64,linux/arm64,linux/arm/v7\"  # 构建多种架构"
    echo "  $0 --push -r myregistry.com  # 构建并推送到指定仓库"
    echo ""
    echo "默认行为:"
    echo "  检测当前系统架构并构建相应镜像"
    echo "  当前检测到的架构: $CURRENT_PLATFORM"
    echo "  镜像名称: orangetv:latest"
}

# 如果没有参数，显示帮助信息
if [ $# -eq 0 ]; then
    show_help
    echo -e "\n${YELLOW}是否使用默认配置开始构建? (y/N)${NC}"
    read -r REPLY
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}已取消构建${NC}"
        exit 0
    fi
fi

# 解析命令行参数
PUSH_IMAGE=false
SINGLE_ARCH=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -i|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -p|--platforms)
            PLATFORMS="$2"
            shift 2
            ;;
        -f|--file)
            DOCKERFILE="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        --push)
            PUSH_IMAGE=true
            shift
            ;;
        --single-arch)
            SINGLE_ARCH="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}未知参数: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: 未找到 Docker，请先安装 Docker${NC}"
    exit 1
fi

# 构建完整的镜像名称
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME:$TAG"
else
    FULL_IMAGE_NAME="$IMAGE_NAME:$TAG"
fi

# 单架构构建模式
if [ -n "$SINGLE_ARCH" ]; then
    echo -e "${BLUE}执行单架构构建...${NC}"
    echo -e "${BLUE}构建信息:${NC}"
    echo "  镜像名称: $FULL_IMAGE_NAME"
    echo "  平台: $SINGLE_ARCH"
    echo "  Dockerfile: $DOCKERFILE"
    echo "  构建上下文: $BUILD_CONTEXT"
    echo "  推送镜像: $PUSH_IMAGE"
    echo ""
    
    # 确认是否继续
    echo -e "${YELLOW}是否继续构建? (y/N)${NC}"
    read -r REPLY
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}已取消构建${NC}"
        exit 0
    fi
    
    # 启用 BuildKit
    export DOCKER_BUILDKIT=1
    
    # 构建命令
    BUILD_CMD="docker build"
    
    # 添加平台参数
    BUILD_CMD="$BUILD_CMD --platform $SINGLE_ARCH"
    
    # 添加标签
    BUILD_CMD="$BUILD_CMD -t $FULL_IMAGE_NAME"
    
    # 添加 Dockerfile
    BUILD_CMD="$BUILD_CMD -f $DOCKERFILE"
    
    # 添加推送参数
    if [ "$PUSH_IMAGE" = true ]; then
        BUILD_CMD="$BUILD_CMD --push"
    else
        BUILD_CMD="$BUILD_CMD --load"  # 加载到本地
    fi
    
    # 添加构建上下文
    BUILD_CMD="$BUILD_CMD $BUILD_CONTEXT"
    
    echo -e "${BLUE}执行命令: $BUILD_CMD${NC}"
    
    # 执行构建
    if eval $BUILD_CMD; then
        echo -e "${GREEN}单架构镜像构建成功!${NC}"
        if [ "$PUSH_IMAGE" = true ]; then
            echo -e "${GREEN}镜像已推送到: $FULL_IMAGE_NAME${NC}"
        else
            echo -e "${GREEN}镜像已本地构建: $FULL_IMAGE_NAME${NC}"
        fi
        exit 0
    else
        echo -e "${RED}单架构镜像构建失败!${NC}"
        exit 1
    fi
fi

# 多架构构建模式
if [ "$PLATFORMS" != "$CURRENT_PLATFORM" ]; then
    echo -e "${BLUE}检查 Docker Buildx 是否可用...${NC}"
    
    # 检查 Docker Buildx 是否可用
    if ! docker buildx version &> /dev/null; then
        echo -e "${YELLOW}警告: Docker Buildx 不可用${NC}"
        echo -e "${YELLOW}请安装 Docker Buildx 或使用 --single-arch 参数进行单架构构建${NC}"
        exit 1
    fi
    
    # 检查是否已有 builder 实例
    BUILDER_NAME="multiarch-builder"
    if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
        echo -e "${BLUE}创建新的 builder 实例...${NC}"
        docker buildx create --name $BUILDER_NAME --use
    fi
    
    # 启用 builder
    docker buildx use $BUILDER_NAME
    
    # 启动 builder
    echo -e "${BLUE}启动 builder...${NC}"
    docker buildx inspect --bootstrap
    
    # 检查 builder 是否支持所需平台
    echo -e "${BLUE}检查构建器支持的平台...${NC}"
    BUILDER_INFO=$(docker buildx inspect)
    echo "$BUILDER_INFO" | grep -A 10 "Platforms" | tail -10
fi

# 显示构建信息
echo -e "${BLUE}构建信息:${NC}"
echo "  镜像名称: $FULL_IMAGE_NAME"
echo "  平台: $PLATFORMS"
echo "  Dockerfile: $DOCKERFILE"
echo "  构建上下文: $BUILD_CONTEXT"
echo "  推送镜像: $PUSH_IMAGE"
echo ""

# 确认是否继续
echo -e "${YELLOW}是否继续构建? (y/N)${NC}"
read -r REPLY
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}已取消构建${NC}"
    exit 0
fi

# 启用 BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 构建镜像
echo -e "${BLUE}开始构建镜像...${NC}"

BUILD_ARGS=""
if [ "$PUSH_IMAGE" = true ]; then
    BUILD_ARGS="--push"
else
    # 对于本地构建，使用 --load 参数加载当前平台镜像
    BUILD_ARGS="--load"
fi

# 执行构建
BUILD_ERROR=0
if [ "$PLATFORMS" != "$CURRENT_PLATFORM" ]; then
    # 多架构构建
    if docker buildx build \
        --platform "$PLATFORMS" \
        -t "$FULL_IMAGE_NAME" \
        -f "$DOCKERFILE" \
        $BUILD_ARGS \
        "$BUILD_CONTEXT"; then
        
        echo -e "${GREEN}多架构镜像构建成功!${NC}"
        
        if [ "$PUSH_IMAGE" = true ]; then
            echo -e "${GREEN}镜像已推送到: $FULL_IMAGE_NAME${NC}"
        else
            echo -e "${GREEN}镜像已构建完成${NC}"
            echo -e "${YELLOW}注意: 多架构构建时，只有当前平台的镜像被加载到本地${NC}"
        fi
        
        # 显示构建的镜像信息
        echo -e "${BLUE}构建的镜像信息:${NC}"
        docker buildx imagetools inspect "$FULL_IMAGE_NAME" || echo "无法检查镜像信息"
    else
        BUILD_ERROR=1
        echo -e "${RED}多架构镜像构建失败!${NC}"
        echo -e "${YELLOW}提示: 如果遇到问题，请尝试以下方法:${NC}"
        echo -e "${YELLOW}1. 使用 --single-arch 参数构建单一架构镜像${NC}"
        echo -e "${YELLOW}2. 使用 --push 参数直接推送到仓库${NC}"
    fi
else
    # 单架构构建（当前平台）
    if docker buildx build \
        --platform "$PLATFORMS" \
        -t "$FULL_IMAGE_NAME" \
        -f "$DOCKERFILE" \
        $BUILD_ARGS \
        "$BUILD_CONTEXT"; then
        
        echo -e "${GREEN}镜像构建成功!${NC}"
        
        if [ "$PUSH_IMAGE" = true ]; then
            echo -e "${GREEN}镜像已推送到: $FULL_IMAGE_NAME${NC}"
        else
            echo -e "${GREEN}镜像已本地构建: $FULL_IMAGE_NAME${NC}"
        fi
        
        # 显示构建的镜像信息
        echo -e "${BLUE}构建的镜像信息:${NC}"
        docker images "$FULL_IMAGE_NAME" || echo "无法检查镜像信息"
    else
        BUILD_ERROR=1
        echo -e "${RED}镜像构建失败!${NC}"
    fi
fi

echo -e "${GREEN}构建完成${NC}"

# 如果构建失败，退出码为1
if [ $BUILD_ERROR -eq 1 ]; then
    exit 1
fi